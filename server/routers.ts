import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { callMultiLLM, testProviderApiKey, streamMultiLLM, detectOllamaModels, isOllamaRunning } from "./_core/multiLLM";
import { storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

function decodeApiKey(enc: string) { return Buffer.from(enc, "base64").toString("utf-8"); }

async function getActiveApiKey(userId: number, provider: string) {
  const keys = await db.getApiKeysByUser(userId);
  const k = keys.find(k => k.provider === provider && k.isActive);
  if (!k) return null;
  return { key: decodeApiKey(k.encryptedKey), baseUrl: k.baseUrl || undefined, id: k.id };
}

function buildMessagesWithAttachments(
  msgs: Array<{ role: string; content: string }>,
  attachmentUrls?: string[]
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const result = msgs.map(m => ({ role: m.role as "system" | "user" | "assistant", content: m.content }));
  if (attachmentUrls?.length) {
    const idx = result.map(m => m.role).lastIndexOf("user");
    if (idx >= 0) {
      const urls = attachmentUrls.map((u, i) => `[Attachment ${i + 1}]: ${u}`).join("\n");
      result[idx] = { ...result[idx], content: `${result[idx].content}\n\nAttached files:\n${urls}` };
    }
  }
  return result;
}

// ── Chat Router ───────────────────────────────────────────────────────────────
const chatRouter = router({
  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      message: z.string().min(1),
      provider: z.string().optional(),
      model: z.string().optional(),
      attachmentUrls: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const conv = await db.getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      const prov = input.provider || conv.provider || "built-in";
      const mod = input.model || conv.model || undefined;
      await db.createMessage({ conversationId: input.conversationId, role: "user", content: input.message, provider: prov, model: mod });
      const prevMsgs = await db.getMessagesByConversation(input.conversationId);
      const sysMsg = prevMsgs.find(m => m.role === "system");
      const history = prevMsgs.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: input.message });
      const allMsgs = sysMsg ? [{ role: "system", content: sysMsg.content }, ...history] : history;
      const withAttach = buildMessagesWithAttachments(allMsgs, input.attachmentUrls);
      let apiKey: string | undefined, baseUrl: string | undefined;
      if (!["built-in", "ollama", "puter"].includes(prov)) {
        const kr = await getActiveApiKey(ctx.user.id, prov);
        if (!kr) throw new TRPCError({ code: "BAD_REQUEST", message: `No active API key for "${prov}". Add one in Settings.` });
        apiKey = kr.key; baseUrl = kr.baseUrl;
      } else {
        const keys = await db.getApiKeysByUser(ctx.user.id);
        const kr = keys.find(k => k.provider === prov);
        if (kr) { if (prov === "puter") apiKey = decodeApiKey(kr.encryptedKey); baseUrl = kr.baseUrl || undefined; }
        if (prov === "ollama") baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      }
      const t0 = Date.now();
      try {
        const result = await callMultiLLM({ messages: withAttach, provider: prov, model: mod, apiKey, baseUrl });
        const dur = Date.now() - t0;
        const aId = await db.createMessage({ conversationId: input.conversationId, role: "assistant", content: result.content, provider: prov, model: result.model || mod, promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens, durationMs: dur });
        await db.createUsageLog({ userId: ctx.user.id, provider: prov, model: result.model || mod || "unknown", promptTokens: result.promptTokens || 0, completionTokens: result.completionTokens || 0, totalTokens: result.totalTokens || 0, estimatedCostUsd: 0, requestType: "chat", success: true, durationMs: dur });
        if (prevMsgs.filter(m => m.role === "user").length === 0) await db.updateConversationTitle(input.conversationId, ctx.user.id, input.message.substring(0, 100));
        return { assistantMessageId: aId, response: result.content, provider: prov, model: result.model || mod };
      } catch (e) {
        const dur = Date.now() - t0;
        await db.createUsageLog({ userId: ctx.user.id, provider: prov, model: mod || "unknown", promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0, requestType: "chat", success: false, errorMessage: e instanceof Error ? e.message : "Unknown", durationMs: dur });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e instanceof Error ? e.message : "Failed" });
      }
    }),

  getConversations: protectedProcedure.query(({ ctx }) => db.getConversationsByUser(ctx.user.id)),

  getConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const conv = await db.getConversationById(input.id, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      const msgs = await db.getMessagesByConversation(input.id);
      const attach = await db.getAttachmentsByConversation(input.id);
      return { conversation: conv, messages: msgs, attachments: attach };
    }),

  createConversation: protectedProcedure
    .input(z.object({ title: z.string().optional(), provider: z.string().optional(), model: z.string().optional(), systemPrompt: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createConversation({ userId: ctx.user.id, title: input.title || "New Conversation", provider: input.provider, model: input.model, systemPrompt: input.systemPrompt });
      return { id };
    }),

  updateConversationTitle: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string() }))
    .mutation(async ({ input, ctx }) => { await db.updateConversationTitle(input.id, ctx.user.id, input.title); return { success: true }; }),

  deleteConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => { await db.deleteConversation(input.id, ctx.user.id); return { success: true }; }),

  togglePin: protectedProcedure
    .input(z.object({ id: z.number(), isPinned: z.boolean() }))
    .mutation(async ({ input, ctx }) => { await db.toggleConversationPin(input.id, ctx.user.id, input.isPinned); return { success: true }; }),

  exportConversation: protectedProcedure
    .input(z.object({ id: z.number(), format: z.enum(["markdown", "json", "txt"]) }))
    .query(async ({ input, ctx }) => {
      const conv = await db.getConversationById(input.id, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      const msgs = await db.getMessagesByConversation(input.id);
      const display = msgs.filter(m => m.role !== "system");
      if (input.format === "json") {
        return { content: JSON.stringify({ conversation: conv, messages: display }, null, 2), mimeType: "application/json", filename: `${conv.title}.json` };
      }
      if (input.format === "markdown") {
        const md = [`# ${conv.title}`, `*Provider: ${conv.provider || "built-in"} · Model: ${conv.model || "default"}*`, `*Exported: ${new Date().toISOString()}*`, "", ...display.map(m => `## ${m.role === "user" ? "🧑 User" : "🤖 Assistant"}\n\n${m.content}`)].join("\n\n");
        return { content: md, mimeType: "text/markdown", filename: `${conv.title}.md` };
      }
      const txt = display.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join("\n\n---\n\n");
      return { content: txt, mimeType: "text/plain", filename: `${conv.title}.txt` };
    }),
});

// ── API Keys Router ───────────────────────────────────────────────────────────
const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await db.getApiKeysByUser(ctx.user.id);
    return keys.map(k => ({ ...k, encryptedKey: undefined }));
  }),
  upsert: protectedProcedure
    .input(z.object({ id: z.number().optional(), provider: z.string(), keyName: z.string(), key: z.string(), baseUrl: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      await db.upsertApiKey({ id: input.id, userId: ctx.user.id, provider: input.provider, keyName: input.keyName, encryptedKey: Buffer.from(input.key).toString("base64"), baseUrl: input.baseUrl, isActive: true });
      return { success: true };
    }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => { await db.deleteApiKey(input.id, ctx.user.id); return { success: true }; }),
  test: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const k = await db.getApiKeyById(input.id, ctx.user.id);
    if (!k) throw new TRPCError({ code: "NOT_FOUND" });
    const result = await testProviderApiKey(k.provider, decodeApiKey(k.encryptedKey), k.baseUrl || undefined);
    await db.updateApiKeyTestStatus(input.id, result.success ? "ok" : "failed");
    return result;
  }),
});

// ── Files Router ──────────────────────────────────────────────────────────────
const filesRouter = router({
  uploadAttachment: protectedProcedure
    .input(z.object({ conversationId: z.number(), fileName: z.string(), fileType: z.string(), fileSize: z.number(), mimeType: z.string(), base64Data: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const conv = await db.getConversationById(input.conversationId, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        const buffer = Buffer.from(input.base64Data, "base64");
        const storageKey = `attachments/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(storageKey, buffer, input.mimeType);
        const id = await db.createAttachment({ conversationId: input.conversationId, userId: ctx.user.id, fileName: input.fileName, fileType: input.fileType, fileSize: input.fileSize, storageKey, storageUrl: url, mimeType: input.mimeType });
        return { attachmentId: id, url };
      } catch (e) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e instanceof Error ? e.message : "Upload failed" }); }
    }),
  transcribeAudio: protectedProcedure
    .input(z.object({ audioUrl: z.string(), language: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        const result = await transcribeAudio({ audioUrl: input.audioUrl, language: input.language });
        if ("error" in result) throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
        return result;
      } catch (e) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e instanceof Error ? e.message : "Transcription failed" }); }
    }),
});

// ── Preferences Router ────────────────────────────────────────────────────────
const preferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    let p = await db.getUserPreferences(ctx.user.id);
    if (!p) { await db.upsertUserPreferences({ userId: ctx.user.id, defaultProvider: "built-in", theme: "system", streamingEnabled: true, cacheEnabled: true, codeSyntaxTheme: "github" }); p = await db.getUserPreferences(ctx.user.id); }
    return p;
  }),
  update: protectedProcedure
    .input(z.object({ defaultProvider: z.string().optional(), defaultModel: z.string().optional(), systemPrompt: z.string().optional(), theme: z.enum(["light", "dark", "system"]).optional(), streamingEnabled: z.boolean().optional(), cacheEnabled: z.boolean().optional(), codeSyntaxTheme: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const cur = await db.getUserPreferences(ctx.user.id);
      await db.upsertUserPreferences({ userId: ctx.user.id, defaultProvider: input.defaultProvider ?? cur?.defaultProvider ?? "built-in", defaultModel: input.defaultModel ?? cur?.defaultModel, systemPrompt: input.systemPrompt ?? cur?.systemPrompt, theme: input.theme ?? cur?.theme ?? "system", streamingEnabled: input.streamingEnabled ?? cur?.streamingEnabled ?? true, cacheEnabled: input.cacheEnabled ?? cur?.cacheEnabled ?? true, codeSyntaxTheme: input.codeSyntaxTheme ?? cur?.codeSyntaxTheme ?? "github" });
      return { success: true };
    }),
});

// ── Usage Router ──────────────────────────────────────────────────────────────
const usageRouter = router({
  getSummary: protectedProcedure.input(z.object({ days: z.number().default(30) })).query(({ input, ctx }) => db.getUsageSummary(ctx.user.id, input.days)),
  getDailyUsage: protectedProcedure.input(z.object({ days: z.number().default(14) })).query(({ input, ctx }) => db.getDailyUsage(ctx.user.id, input.days)),
});

// ── Prompt Templates Router ───────────────────────────────────────────────────
const templatesRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.getPromptTemplatesByUser(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional(), systemPrompt: z.string().min(1), userPrompt: z.string().optional(), provider: z.string().optional(), model: z.string().optional(), tags: z.array(z.string()).optional() }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createPromptTemplate({ userId: ctx.user.id, name: input.name, description: input.description, systemPrompt: input.systemPrompt, userPrompt: input.userPrompt, provider: input.provider, model: input.model, tags: input.tags });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), systemPrompt: z.string().optional(), userPrompt: z.string().optional(), provider: z.string().optional(), model: z.string().optional(), tags: z.array(z.string()).optional() }))
    .mutation(async ({ input, ctx }) => { const { id, ...data } = input; await db.updatePromptTemplate(id, ctx.user.id, data); return { success: true }; }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => { await db.deletePromptTemplate(input.id, ctx.user.id); return { success: true }; }),

  use: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const t = await db.getPromptTemplateById(input.id, ctx.user.id);
    if (!t) throw new TRPCError({ code: "NOT_FOUND" });
    await db.incrementTemplateUseCount(input.id);
    return t;
  }),
});

// ── RAG Router ────────────────────────────────────────────────────────────────
const ragRouter = router({
  listDocuments: protectedProcedure.query(({ ctx }) => db.getRagDocumentsByUser(ctx.user.id)),

  uploadDocument: protectedProcedure
    .input(z.object({ name: z.string(), content: z.string(), sourceFile: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      // Chunk document into ~1000 char chunks with 100 char overlap
      const CHUNK_SIZE = 1000, OVERLAP = 100;
      const text = input.content;
      const chunks: string[] = [];
      let i = 0;
      while (i < text.length) { chunks.push(text.slice(i, i + CHUNK_SIZE)); i += CHUNK_SIZE - OVERLAP; }
      const ids: number[] = [];
      for (let ci = 0; ci < chunks.length; ci++) {
        const id = await db.createRagDocument({
          userId: ctx.user.id, name: input.name, content: chunks[ci],
          chunkIndex: ci, totalChunks: chunks.length,
          sourceFile: input.sourceFile || input.name,
          metadata: { totalLength: text.length, chunkSize: CHUNK_SIZE },
        });
        ids.push(id);
      }
      return { ids, chunks: chunks.length };
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ sourceFile: z.string() }))
    .mutation(async ({ input, ctx }) => { await db.deleteRagDocument(ctx.user.id, input.sourceFile); return { success: true }; }),

  search: protectedProcedure
    .input(z.object({ query: z.string(), topK: z.number().default(5) }))
    .query(async ({ input, ctx }) => {
      // Simple keyword search (production would use vector embeddings)
      const allChunks = await db.getAllRagChunks(ctx.user.id);
      const q = input.query.toLowerCase();
      const scored = allChunks.map(c => {
        const words = q.split(/\s+/);
        const score = words.reduce((acc, w) => acc + (c.content.toLowerCase().includes(w) ? 1 : 0), 0);
        return { ...c, score };
      }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, input.topK);
      return scored;
    }),
});

// ── Image Generation Router ───────────────────────────────────────────────────
const imageGenRouter = router({
  generate: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1),
      provider: z.enum(["openai", "stability"]),
      model: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      conversationId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const kr = await getActiveApiKey(ctx.user.id, input.provider);
      if (!kr) throw new TRPCError({ code: "BAD_REQUEST", message: `No API key for ${input.provider}` });

      let imageUrl = "";
      if (input.provider === "openai") {
        const model = input.model || "dall-e-3";
        const size = `${input.width || 1024}x${input.height || 1024}`;
        const r = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${kr.key}` },
          body: JSON.stringify({ model, prompt: input.prompt, n: 1, size }),
        });
        if (!r.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `OpenAI image error: ${await r.text()}` });
        const data = await r.json() as any;
        imageUrl = data.data?.[0]?.url || "";
      } else if (input.provider === "stability") {
        const r = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${kr.key}` },
          body: JSON.stringify({ text_prompts: [{ text: input.prompt }], cfg_scale: 7, height: input.height || 1024, width: input.width || 1024, steps: 30, samples: 1 }),
        });
        if (!r.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Stability AI error: ${await r.text()}` });
        const data = await r.json() as any;
        const b64 = data.artifacts?.[0]?.base64;
        imageUrl = b64 ? `data:image/png;base64,${b64}` : "";
      }

      await db.createImageGeneration({ userId: ctx.user.id, conversationId: input.conversationId, prompt: input.prompt, provider: input.provider, model: input.model || "default", imageUrl, width: input.width, height: input.height });
      return { imageUrl };
    }),

  list: protectedProcedure.query(({ ctx }) => db.getImageGenerationsByUser(ctx.user.id)),
});

// ── Benchmark Router ──────────────────────────────────────────────────────────
const benchmarkRouter = router({
  run: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1),
      providers: z.array(z.object({ provider: z.string(), model: z.string().optional() })),
    }))
    .mutation(async ({ input, ctx }) => {
      const results: Array<{ provider: string; model: string; response: string; durationMs: number; tokens: number; error?: string }> = [];

      await Promise.allSettled(input.providers.map(async ({ provider, model }) => {
        let apiKey: string | undefined, baseUrl: string | undefined;
        if (!["built-in", "ollama", "puter"].includes(provider)) {
          const kr = await getActiveApiKey(ctx.user.id, provider);
          if (!kr) { results.push({ provider, model: model || "default", response: "", durationMs: 0, tokens: 0, error: "No API key configured" }); return; }
          apiKey = kr.key; baseUrl = kr.baseUrl;
        } else if (provider === "ollama") {
          const keys = await db.getApiKeysByUser(ctx.user.id);
          const kr = keys.find(k => k.provider === "ollama");
          baseUrl = kr?.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        }
        const t0 = Date.now();
        try {
          const r = await callMultiLLM({ messages: [{ role: "user", content: input.prompt }], provider, model, apiKey, baseUrl, maxTokens: 1024 });
          results.push({ provider, model: r.model || model || "default", response: r.content, durationMs: Date.now() - t0, tokens: r.totalTokens || 0 });
        } catch (e) {
          results.push({ provider, model: model || "default", response: "", durationMs: Date.now() - t0, tokens: 0, error: e instanceof Error ? e.message : "Failed" });
        }
      }));

      const id = await db.createBenchmark({ userId: ctx.user.id, prompt: input.prompt, results });
      return { id, results };
    }),

  list: protectedProcedure.query(({ ctx }) => db.getBenchmarksByUser(ctx.user.id)),
});

// ── Providers Router ──────────────────────────────────────────────────────────
const providersRouter = router({
  detectOllama: protectedProcedure
    .input(z.object({ baseUrl: z.string().optional() }))
    .query(async ({ input }) => {
      const url = input.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const running = await isOllamaRunning(url);
      if (!running) return { running: false, models: [] as Array<{ name: string; size: number; modifiedAt: string }> };
      return { running: true, models: await detectOllamaModels(url) };
    }),
});

// ── Main App Router ───────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const opts = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...opts, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  chat: chatRouter,
  apiKeys: apiKeysRouter,
  files: filesRouter,
  preferences: preferencesRouter,
  usage: usageRouter,
  templates: templatesRouter,
  rag: ragRouter,
  imageGen: imageGenRouter,
  benchmark: benchmarkRouter,
  providers: providersRouter,
});

export type AppRouter = typeof appRouter;
