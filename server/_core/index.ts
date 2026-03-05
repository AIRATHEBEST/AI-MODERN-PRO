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
import { registerUploadsRoute } from "../storage";
import { sdk } from "./sdk";
import * as db from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createServer();
    s.listen(port, () => { s.close(() => resolve(true)); });
    s.on("error", () => resolve(false));
  });
}
async function findAvailablePort(start = 3000): Promise<number> {
  for (let p = start; p < start + 20; p++) if (await isPortAvailable(p)) return p;
  throw new Error("No available port");
}

function decodeApiKey(enc: string) { return Buffer.from(enc, "base64").toString("utf-8"); }

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve uploaded files
  registerUploadsRoute(app);
  registerOAuthRoutes(app);

  // ── Seed default user on startup ────────────────────────────────────────────
  (async () => {
    try {
      const { getSupabaseAdmin } = await import("./supabase");
      const supabase = getSupabaseAdmin();
      const SEED_EMAIL = "ntshongwanae@gmail.com";
      const SEED_PASSWORD = "@960145404";
      const { data: listData } = await supabase.auth.admin.listUsers();
      const exists = listData?.users?.find(
        u => u.email?.toLowerCase() === SEED_EMAIL
      );
      if (!exists) {
        await supabase.auth.admin.createUser({
          email: SEED_EMAIL,
          password: SEED_PASSWORD,
          email_confirm: true,
          user_metadata: { name: "Ntshongwanae" },
        });
        console.log("[Seed] Default user created:", SEED_EMAIL);
      }
    } catch (e) {
      console.warn("[Seed] Could not seed default user:", e instanceof Error ? e.message : e);
    }
  })();

  // ── SSE Streaming ────────────────────────────────────────────────────────────
  app.post("/api/stream/chat", async (req: Request, res: Response) => {
    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
    try { user = await sdk.authenticateRequest(req); } catch { res.status(401).json({ error: "Unauthorized" }); return; }

    const { conversationId, message, provider, model, attachmentUrls } = req.body as {
      conversationId: number; message: string; provider?: string; model?: string; attachmentUrls?: string[];
    };
    
    console.log("[SSE] New request - Provider:", provider, "Model:", model);
    
    if (!message || !conversationId) { res.status(400).json({ error: "message and conversationId required" }); return; }

    try {
      const conv = await db.getConversationById(conversationId, user.id);
      if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
      const prov = provider || conv.provider || "built-in";
      const mod = model || conv.model || undefined;

      await db.createMessage({ conversationId, role: "user", content: message, provider: prov, model: mod });
      const prevMsgs = await db.getMessagesByConversation(conversationId);
      const sysMsg = prevMsgs.find(m => m.role === "system");
      const history = prevMsgs.filter(m => m.role !== "system").map(m => ({ role: m.role as "user"|"assistant", content: m.content }));
      history.push({ role: "user", content: message });
      let allMsgs: Array<{ role: "system"|"user"|"assistant"; content: string }> = sysMsg ? [{ role: "system", content: sysMsg.content }, ...history] : history;
      if (attachmentUrls?.length) {
        const idx = allMsgs.map(m => m.role).lastIndexOf("user");
        if (idx >= 0) { const urls = attachmentUrls.map((u,i) => `[Attachment ${i+1}]: ${u}`).join("\n"); allMsgs[idx] = { ...allMsgs[idx], content: `${allMsgs[idx].content}\n\nAttached files:\n${urls}` }; }
      }

      let apiKey: string | undefined, baseUrl: string | undefined;
      if (!["built-in","ollama","puter"].includes(prov)) {
        const keys = await db.getApiKeysByUser(user.id);
        const kr = keys.find(k => k.provider === prov && k.isActive);
        if (!kr) { res.status(400).json({ error: `No active API key for "${prov}". Add one in Settings.` }); return; }
        apiKey = decodeApiKey(kr.encryptedKey); baseUrl = kr.baseUrl || undefined;
      } else {
        const keys = await db.getApiKeysByUser(user.id);
        const kr = keys.find(k => k.provider === prov);
        if (kr) { if (prov === "puter") apiKey = decodeApiKey(kr.encryptedKey); baseUrl = kr.baseUrl || undefined; }
        if (prov === "ollama") baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      let full = "", promptTokens = 0, completionTokens = 0, totalTokens = 0, finalModel = mod;
      const t0 = Date.now();

      try {
        for await (const chunk of streamMultiLLM({ messages: allMsgs, provider: prov, model: mod, apiKey, baseUrl })) {
          if (res.destroyed) break;
          if (chunk.type === "delta" && chunk.content) { full += chunk.content; res.write(`data: ${JSON.stringify({ type: "delta", content: chunk.content })}\n\n`); }
          else if (chunk.type === "done") { if (chunk.usage) { promptTokens = chunk.usage.promptTokens||0; completionTokens = chunk.usage.completionTokens||0; totalTokens = chunk.usage.totalTokens||0; } if (chunk.model) finalModel = chunk.model; }
          else if (chunk.type === "error") { res.write(`data: ${JSON.stringify({ type: "error", error: chunk.error })}\n\n`); res.write("data: [DONE]\n\n"); res.end(); return; }
        }
        const dur = Date.now() - t0;
        const aId = await db.createMessage({ conversationId, role: "assistant", content: full, provider: prov, model: finalModel, promptTokens, completionTokens, totalTokens, durationMs: dur });
        await db.createUsageLog({ userId: user.id, provider: prov, model: finalModel||"unknown", promptTokens, completionTokens, totalTokens, estimatedCostUsd: 0, requestType: "chat", success: true, durationMs: dur });
        if (prevMsgs.filter(m => m.role === "user").length === 0) await db.updateConversationTitle(conversationId, user.id, message.substring(0, 100));
        res.write(`data: ${JSON.stringify({ type: "done", assistantMessageId: aId, model: finalModel, provider: prov, usage: { promptTokens, completionTokens, totalTokens } })}\n\n`);
        res.write("data: [DONE]\n\n"); res.end();
      } catch (e) {
        const dur = Date.now() - t0;
        await db.createUsageLog({ userId: user.id, provider: prov, model: mod||"unknown", promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0, requestType: "chat", success: false, errorMessage: e instanceof Error ? e.message : "Error", durationMs: dur });
        if (!res.headersSent) { res.status(500).json({ error: e instanceof Error ? e.message : "Stream failed" }); }
        else { res.write(`data: ${JSON.stringify({ type: "error", error: e instanceof Error ? e.message : "Stream failed" })}\n\n`); res.write("data: [DONE]\n\n"); res.end(); }
      }
    } catch (e) { if (!res.headersSent) res.status(500).json({ error: "Server error" }); }
  });

  // ── Ollama auto-detect ───────────────────────────────────────────────────────
  app.get("/api/ollama/models", async (req: Request, res: Response) => {
    try { await sdk.authenticateRequest(req); } catch { res.status(401).json({ error: "Unauthorized" }); return; }
    const baseUrl = (req.query.baseUrl as string) || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const running = await isOllamaRunning(baseUrl);
    if (!running) { res.json({ running: false, models: [] }); return; }
    res.json({ running: true, models: await detectOllamaModels(baseUrl) });
  });

  // ── Code execution sandbox ───────────────────────────────────────────────────
  app.post("/api/code/execute", async (req: Request, res: Response) => {
    try { await sdk.authenticateRequest(req); } catch { res.status(401).json({ error: "Unauthorized" }); return; }
    const { code, language } = req.body as { code: string; language: string };
    if (!code) { res.status(400).json({ error: "code required" }); return; }
    
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    const os = await import("os");
    const path = await import("path");
    const fs = await import("fs");
    
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    let filename: string, cmd: string;
    
    if (language === "python") {
      filename = path.join(tmpDir, `exec_${timestamp}.py`);
      fs.writeFileSync(filename, code);
      cmd = `timeout 10 python3 "${filename}"`;
    } else if (language === "javascript" || language === "js") {
      filename = path.join(tmpDir, `exec_${timestamp}.js`);
      fs.writeFileSync(filename, code);
      cmd = `timeout 10 node "${filename}"`;
    } else if (language === "bash" || language === "sh") {
      filename = path.join(tmpDir, `exec_${timestamp}.sh`);
      fs.writeFileSync(filename, code);
      cmd = `timeout 10 bash "${filename}"`;
    } else if (language === "typescript" || language === "ts") {
      filename = path.join(tmpDir, `exec_${timestamp}.ts`);
      fs.writeFileSync(filename, code);
      cmd = `timeout 10 npx ts-node --skipProject "${filename}"`;
    } else {
      res.json({ output: "", error: `Language "${language}" not supported. Use: python, javascript, bash, typescript`, exitCode: 1 });
      return;
    }
    
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 12000, maxBuffer: 1024 * 1024 });
      try { fs.unlinkSync(filename); } catch {}
      res.json({ output: stdout, error: stderr, exitCode: 0 });
    } catch (e: any) {
      try { fs.unlinkSync(filename); } catch {}
      res.json({ output: e.stdout || "", error: e.stderr || e.message || "Execution failed", exitCode: e.code || 1 });
    }
  });

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);

  const preferred = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferred);
  if (port !== preferred) console.log(`Port ${preferred} busy, using ${port}`);

  server.listen(port, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🤖 AI Assistant  →  http://localhost:${port}                  ║
║                                                              ║
║  Providers: OpenAI · Claude · Gemini · Ollama                ║
║             Deepseek · Grok · HuggingFace · Puter            ║
║                                                              ║
║  Features:  ⚡ SSE Streaming  🦙 Ollama Auto-detect          ║
║             📎 File Upload    🖼  Image Gen                   ║
║             🔍 RAG Search     ⚙️  Code Exec                   ║
║             📋 Templates      ⚖️  Benchmarks                  ║
║             📤 Export         🌗 Dark Mode                   ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);
