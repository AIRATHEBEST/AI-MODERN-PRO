import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { callMultiLLM, testProviderApiKey } from "./_core/multiLLM";
import { storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

// ── Helper: decode stored API key ─────────────────────────────────────────────
function decodeApiKey(encryptedKey: string): string {
  return Buffer.from(encryptedKey, "base64").toString("utf-8");
}

// ── Helper: get active API key for a provider ─────────────────────────────────
async function getActiveApiKey(userId: number, provider: string) {
  const keys = await db.getApiKeysByUser(userId);
  const key = keys.find((k) => k.provider === provider && k.isActive);
  if (!key) return null;
  return {
    key: decodeApiKey(key.encryptedKey),
    baseUrl: key.baseUrl || undefined,
    id: key.id,
  };
}

// ── Helper: build messages with attachment context ────────────────────────────
function buildMessagesWithAttachments(
  messages: Array<{ role: string; content: string }>,
  attachmentUrls?: string[]
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const result = messages.map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
  }));

  if (attachmentUrls && attachmentUrls.length > 0) {
    const lastUserIdx = result.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx >= 0) {
      const urlList = attachmentUrls.map((u, i) => `[Attachment ${i + 1}]: ${u}`).join("\n");
      result[lastUserIdx] = {
        ...result[lastUserIdx],
        content: `${result[lastUserIdx].content}\n\nAttached files:\n${urlList}`,
      };
    }
  }

  return result;
}

// ── Chat Router ───────────────────────────────────────────────────────────────
const chatRouter = router({
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        message: z.string().min(1),
        provider: z.string().optional(),
        model: z.string().optional(),
        attachmentUrls: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const conversation = await db.getConversationById(input.conversationId, ctx.user.id);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND" });

      const effectiveProvider = input.provider || conversation.provider || "built-in";
      const effectiveModel = input.model || conversation.model || undefined;

      const userMessageId = await db.createMessage({
        conversationId: input.conversationId,
        role: "user",
        content: input.message,
        provider: effectiveProvider,
        model: effectiveModel,
      });

      const previousMessages = await db.getMessagesByConversation(input.conversationId);
      const systemMessages = previousMessages.filter((m) => m.role === "system");
      const systemPrompt = systemMessages[0]?.content || conversation.systemPrompt;

      const conversationHistory = previousMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      conversationHistory.push({ role: "user", content: input.message });

      const allMessages: Array<{ role: string; content: string }> = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...conversationHistory]
        : conversationHistory;

      const messagesWithAttachments = buildMessagesWithAttachments(
        allMessages,
        input.attachmentUrls
      );

      let apiKey: string | undefined;
      let baseUrl: string | undefined;

      if (effectiveProvider !== "built-in") {
        const keyRecord = await getActiveApiKey(ctx.user.id, effectiveProvider);
        if (!keyRecord) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `No active API key found for provider "${effectiveProvider}". Please add one in Settings.`,
          });
        }
        apiKey = keyRecord.key;
        baseUrl = keyRecord.baseUrl;
      }

      const startTime = Date.now();

      try {
        const result = await callMultiLLM({
          messages: messagesWithAttachments,
          provider: effectiveProvider,
          model: effectiveModel,
          apiKey,
          baseUrl,
        });

        const durationMs = Date.now() - startTime;
        const assistantContent = result.content;

        const assistantMessageId = await db.createMessage({
          conversationId: input.conversationId,
          role: "assistant",
          content: assistantContent,
          provider: effectiveProvider,
          model: result.model || effectiveModel,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          durationMs,
        });

        await db.createUsageLog({
          userId: ctx.user.id,
          provider: effectiveProvider,
          model: result.model || effectiveModel || "unknown",
          promptTokens: result.promptTokens || 0,
          completionTokens: result.completionTokens || 0,
          totalTokens: result.totalTokens || 0,
          estimatedCostUsd: 0,
          requestType: "chat",
          success: true,
          durationMs,
        });

        // Update conversation title from first user message
        const userMsgCount = previousMessages.filter((m) => m.role === "user").length;
        if (userMsgCount === 0) {
          await db.updateConversationTitle(
            input.conversationId,
            ctx.user.id,
            input.message.substring(0, 100)
          );
        }

        return {
          userMessageId,
          assistantMessageId,
          response: assistantContent,
          tokens: {
            prompt_tokens: result.promptTokens,
            completion_tokens: result.completionTokens,
            total_tokens: result.totalTokens,
          },
          provider: effectiveProvider,
          model: result.model || effectiveModel,
        };
      } catch (error) {
        const durationMs = Date.now() - startTime;

        await db.createUsageLog({
          userId: ctx.user.id,
          provider: effectiveProvider,
          model: effectiveModel || "unknown",
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          requestType: "chat",
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          durationMs,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get response",
        });
      }
    }),

  getConversations: protectedProcedure.query(async ({ ctx }) => {
    return db.getConversationsByUser(ctx.user.id);
  }),

  getConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const conversation = await db.getConversationById(input.id, ctx.user.id);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND" });

      const messages = await db.getMessagesByConversation(input.id);
      const attachments = await db.getAttachmentsByConversation(input.id);

      return { conversation, messages, attachments };
    }),

  createConversation: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
        provider: z.string().optional(),
        model: z.string().optional(),
        systemPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await db.createConversation({
        userId: ctx.user.id,
        title: input.title || "New Conversation",
        provider: input.provider,
        model: input.model,
        systemPrompt: input.systemPrompt,
      });
      return { id };
    }),

  updateConversationTitle: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db.updateConversationTitle(input.id, ctx.user.id, input.title);
      return { success: true };
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteConversation(input.id, ctx.user.id);
      return { success: true };
    }),

  togglePin: protectedProcedure
    .input(z.object({ id: z.number(), isPinned: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await db.toggleConversationPin(input.id, ctx.user.id, input.isPinned);
      return { success: true };
    }),
});

// ── API Keys Router ───────────────────────────────────────────────────────────
const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await db.getApiKeysByUser(ctx.user.id);
    return keys.map((k) => ({
      ...k,
      encryptedKey: undefined,
    }));
  }),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        provider: z.string(),
        keyName: z.string(),
        key: z.string(),
        baseUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const encryptedKey = Buffer.from(input.key).toString("base64");

      await db.upsertApiKey({
        id: input.id,
        userId: ctx.user.id,
        provider: input.provider,
        keyName: input.keyName,
        encryptedKey,
        baseUrl: input.baseUrl,
        isActive: true,
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteApiKey(input.id, ctx.user.id);
      return { success: true };
    }),

  test: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const key = await db.getApiKeyById(input.id, ctx.user.id);
      if (!key) throw new TRPCError({ code: "NOT_FOUND" });

      const decodedKey = decodeApiKey(key.encryptedKey);
      const result = await testProviderApiKey(key.provider, decodedKey, key.baseUrl || undefined);

      if (result.success) {
        await db.updateApiKeyTestStatus(input.id, "ok");
        return { success: true, status: "ok" };
      } else {
        await db.updateApiKeyTestStatus(input.id, "failed");
        return {
          success: false,
          status: "failed",
          error: result.error || "Test failed",
        };
      }
    }),
});

// ── File Upload Router ────────────────────────────────────────────────────────
const filesRouter = router({
  uploadAttachment: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
        base64Data: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const conversation = await db.getConversationById(input.conversationId, ctx.user.id);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        const buffer = Buffer.from(input.base64Data, "base64");
        const storageKey = `attachments/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(storageKey, buffer, input.mimeType);

        const attachmentId = await db.createAttachment({
          conversationId: input.conversationId,
          userId: ctx.user.id,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
          storageKey,
          storageUrl: url,
          mimeType: input.mimeType,
        });

        return { attachmentId, url };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }),

  transcribeAudio: protectedProcedure
    .input(
      z.object({
        audioUrl: z.string(),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: input.language,
        });

        if ("error" in result) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error,
          });
        }

        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Transcription failed",
        });
      }
    }),
});

// ── Preferences Router ────────────────────────────────────────────────────────
const preferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    let prefs = await db.getUserPreferences(ctx.user.id);
    if (!prefs) {
      await db.upsertUserPreferences({
        userId: ctx.user.id,
        defaultProvider: "built-in",
        theme: "system",
        streamingEnabled: true,
        cacheEnabled: true,
        codeSyntaxTheme: "github",
      });
      prefs = await db.getUserPreferences(ctx.user.id);
    }
    return prefs;
  }),

  update: protectedProcedure
    .input(
      z.object({
        defaultProvider: z.string().optional(),
        defaultModel: z.string().optional(),
        systemPrompt: z.string().optional(),
        theme: z.enum(["light", "dark", "system"]).optional(),
        streamingEnabled: z.boolean().optional(),
        cacheEnabled: z.boolean().optional(),
        codeSyntaxTheme: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const current = await db.getUserPreferences(ctx.user.id);
      await db.upsertUserPreferences({
        userId: ctx.user.id,
        defaultProvider: input.defaultProvider ?? current?.defaultProvider ?? "built-in",
        defaultModel: input.defaultModel ?? current?.defaultModel,
        systemPrompt: input.systemPrompt ?? current?.systemPrompt,
        theme: input.theme ?? current?.theme ?? "system",
        streamingEnabled: input.streamingEnabled ?? current?.streamingEnabled ?? true,
        cacheEnabled: input.cacheEnabled ?? current?.cacheEnabled ?? true,
        codeSyntaxTheme: input.codeSyntaxTheme ?? current?.codeSyntaxTheme ?? "github",
      });
      return { success: true };
    }),
});

// ── Usage Router ──────────────────────────────────────────────────────────────
const usageRouter = router({
  getSummary: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input, ctx }) => {
      return db.getUsageSummary(ctx.user.id, input.days);
    }),

  getDailyUsage: protectedProcedure
    .input(z.object({ days: z.number().default(14) }))
    .query(async ({ input, ctx }) => {
      return db.getDailyUsage(ctx.user.id, input.days);
    }),
});

// ── Main App Router ───────────────────────────────────────────────────────────

// ── Providers Router (metadata + Ollama detection) ────────────────────────────
const providersRouter = router({
  getMetadata: publicProcedure.query(() => {
    const { PROVIDER_METADATA } = require("./_core/multiLLM");
    return PROVIDER_METADATA;
  }),

  detectOllama: protectedProcedure
    .input(z.object({ baseUrl: z.string().optional() }))
    .query(async ({ input }) => {
      const { detectOllamaModels, isOllamaRunning } = await import("./_core/multiLLM");
      const baseUrl = input.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const running = await isOllamaRunning(baseUrl);
      if (!running) return { running: false, models: [] as Array<{ name: string; size: number; modifiedAt: string }> };
      const models = await detectOllamaModels(baseUrl);
      return { running: true, models };
    }),
});

// ── Main App Router ───────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  chat: chatRouter,
  apiKeys: apiKeysRouter,
  files: filesRouter,
  preferences: preferencesRouter,
  usage: usageRouter,
  providers: providersRouter,
});

export type AppRouter = typeof appRouter;
