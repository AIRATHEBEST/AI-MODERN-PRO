import "dotenv/config";
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { streamMultiLLM, detectOllamaModels, isOllamaRunning } from "./multiLLM";
import { sdk } from "./sdk";
import * as db from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error("No available port found");
}

function decodeApiKey(encryptedKey: string): string {
  return Buffer.from(encryptedKey, "base64").toString("utf-8");
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  // ── True SSE Streaming endpoint ────────────────────────────────────────────
  app.post("/api/stream/chat", async (req: Request, res: Response) => {
    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { conversationId, message, provider, model, attachmentUrls } = req.body as {
      conversationId: number;
      message: string;
      provider?: string;
      model?: string;
      attachmentUrls?: string[];
    };

    if (!message || !conversationId) {
      res.status(400).json({ error: "message and conversationId required" });
      return;
    }

    try {
      const conversation = await db.getConversationById(conversationId, user.id);
      if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }

      const effectiveProvider = provider || conversation.provider || "built-in";
      const effectiveModel = model || conversation.model || undefined;

      await db.createMessage({ conversationId, role: "user", content: message, provider: effectiveProvider, model: effectiveModel });

      const previousMessages = await db.getMessagesByConversation(conversationId);
      const systemMsg = previousMessages.find(m => m.role === "system");
      const systemPrompt = systemMsg?.content || conversation.systemPrompt;
      const history = previousMessages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      history.push({ role: "user", content: message });

      let allMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...history]
        : history;

      if (attachmentUrls && attachmentUrls.length > 0) {
        const lastUserIdx = allMessages.map(m => m.role).lastIndexOf("user");
        if (lastUserIdx >= 0) {
          const urlList = attachmentUrls.map((u, i) => `[Attachment ${i + 1}]: ${u}`).join("\n");
          allMessages[lastUserIdx] = { ...allMessages[lastUserIdx], content: `${allMessages[lastUserIdx].content}\n\nAttached files:\n${urlList}` };
        }
      }

      let apiKey: string | undefined;
      let baseUrl: string | undefined;

      if (!["built-in", "ollama", "puter"].includes(effectiveProvider)) {
        const keys = await db.getApiKeysByUser(user.id);
        const keyRecord = keys.find(k => k.provider === effectiveProvider && k.isActive);
        if (!keyRecord) { res.status(400).json({ error: `No active API key for "${effectiveProvider}". Add one in Settings.` }); return; }
        apiKey = decodeApiKey(keyRecord.encryptedKey);
        baseUrl = keyRecord.baseUrl || undefined;
      } else {
        const keys = await db.getApiKeysByUser(user.id);
        const keyRecord = keys.find(k => k.provider === effectiveProvider);
        if (keyRecord) {
          if (effectiveProvider === "puter") apiKey = decodeApiKey(keyRecord.encryptedKey);
          baseUrl = keyRecord.baseUrl || undefined;
        }
        if (effectiveProvider === "ollama") {
          baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        }
      }

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      let fullContent = "";
      let promptTokens = 0, completionTokens = 0, totalTokens = 0;
      let finalModel = effectiveModel;
      const startTime = Date.now();

      try {
        const stream = streamMultiLLM({ messages: allMessages, provider: effectiveProvider, model: effectiveModel, apiKey, baseUrl });

        for await (const chunk of stream) {
          if (res.destroyed) break;

          if (chunk.type === "delta" && chunk.content) {
            fullContent += chunk.content;
            res.write(`data: ${JSON.stringify({ type: "delta", content: chunk.content })}\n\n`);
          } else if (chunk.type === "done") {
            if (chunk.usage) {
              promptTokens = chunk.usage.promptTokens || 0;
              completionTokens = chunk.usage.completionTokens || 0;
              totalTokens = chunk.usage.totalTokens || 0;
            }
            if (chunk.model) finalModel = chunk.model;
          } else if (chunk.type === "error") {
            res.write(`data: ${JSON.stringify({ type: "error", error: chunk.error })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
        }

        const durationMs = Date.now() - startTime;

        const assistantMessageId = await db.createMessage({
          conversationId, role: "assistant", content: fullContent,
          provider: effectiveProvider, model: finalModel,
          promptTokens, completionTokens, totalTokens, durationMs,
        });

        await db.createUsageLog({
          userId: user.id, provider: effectiveProvider, model: finalModel || "unknown",
          promptTokens, completionTokens, totalTokens, estimatedCostUsd: 0,
          requestType: "chat", success: true, durationMs,
        });

        const userMsgCount = previousMessages.filter(m => m.role === "user").length;
        if (userMsgCount === 0) await db.updateConversationTitle(conversationId, user.id, message.substring(0, 100));

        res.write(`data: ${JSON.stringify({ type: "done", assistantMessageId, model: finalModel, provider: effectiveProvider, usage: { promptTokens, completionTokens, totalTokens } })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (streamError) {
        const durationMs = Date.now() - startTime;
        await db.createUsageLog({ userId: user.id, provider: effectiveProvider, model: effectiveModel || "unknown", promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0, requestType: "chat", success: false, errorMessage: streamError instanceof Error ? streamError.message : "Stream error", durationMs });

        if (!res.headersSent) {
          res.status(500).json({ error: streamError instanceof Error ? streamError.message : "Stream failed" });
        } else {
          res.write(`data: ${JSON.stringify({ type: "error", error: streamError instanceof Error ? streamError.message : "Stream failed" })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        }
      }
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ error: error instanceof Error ? error.message : "Server error" });
    }
  });

  // ── Ollama model auto-detection ────────────────────────────────────────────
  app.get("/api/ollama/models", async (req: Request, res: Response) => {
    try {
      await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const baseUrl = (req.query.baseUrl as string) || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const running = await isOllamaRunning(baseUrl);
    if (!running) { res.json({ running: false, models: [] }); return; }
    const models = await detectOllamaModels(baseUrl);
    res.json({ running: true, models });
  });

  // ── tRPC API ───────────────────────────────────────────────────────────────
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} busy, using ${port}`);

  server.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║  🤖 AI Assistant  →  http://localhost:${port}        ║
║  Providers: OpenAI │ Claude │ Gemini │ Ollama       ║
║             Deepseek │ Grok │ HuggingFace │ Puter   ║
║  SSE Streaming enabled ✓  Ollama auto-detect ✓     ║
╚════════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);
