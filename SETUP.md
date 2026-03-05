# 🤖 AI Assistant — Setup Guide

## Quick Start (5 minutes)

```bash
# 1. Unzip
unzip ai_assistant_upgraded.zip
cd ai_assistant_upgraded

# 2. Configure
cp .env.example .env
# Edit .env — set DATABASE_URL + JWT_SECRET at minimum

# 3. Install
pnpm install

# 4. Create tables
pnpm db:push

# 5. Start
pnpm dev
# → http://localhost:3000
```

---

## Feature Guide

### ⚡ Chat with SSE Streaming
Live token-by-token streaming for all providers.  
Provider and model selector is built into the chat input bar.  
Stop generation mid-stream with the red stop button.

### 🦙 Ollama (Local AI — Free)
1. Install Ollama: https://ollama.com
2. Pull a model: `ollama pull llama3.2`
3. Select **Ollama** from the provider dropdown — models auto-populate

### 📋 Prompt Templates
Save system prompts and conversation starters.  
Templates tab → Create → Use → opens a new conversation pre-configured.

### 🔍 RAG Knowledge Base
1. Go to RAG tab → Upload a `.txt`, `.md`, `.py`, etc. file
2. Type a search query to find relevant chunks
3. Click **Inject into Chat** — context is pre-filled into the message input

### 🖼 Image Generation
Requires an OpenAI or Stability AI key in Settings.  
Images tab → type a prompt → Generate → download.

### ⚙️ Code Execution Sandbox
Code tab — write Python, JavaScript, TypeScript, or Bash.  
Ctrl+Enter to run. Output displayed inline with syntax highlighting.  
Execution is sandboxed with a 10-second timeout.

### ⚖️ Model Benchmarking
Benchmark tab → enter a prompt → select providers → Run.  
Results show side-by-side with speed and token counts.

### 📤 Export Conversations
Sidebar → use the `.md` `.json` `.txt` buttons under "New Chat".  
Downloads the current conversation in your chosen format.

### 📎 File Attachments
Click the paperclip icon in chat. Files are saved locally in `./uploads/`.

---

## API Keys

Go to **Settings** tab → Add keys per provider.  
Keys are base64-encoded and stored in your own database — never sent to Anthropic.

| Provider      | Where to get a key                        |
|---------------|-------------------------------------------|
| OpenAI        | https://platform.openai.com/api-keys      |
| Claude        | https://console.anthropic.com             |
| Gemini        | https://aistudio.google.com/app/apikey    |
| Deepseek      | https://platform.deepseek.com             |
| Grok          | https://console.x.ai                      |
| HuggingFace   | https://huggingface.co/settings/tokens    |
| Stability AI  | https://platform.stability.ai             |
| Puter         | ✨ Free — no key needed                    |
| Ollama        | ✨ Free — runs locally                     |

---

## Architecture

```
client/src/
  pages/Home.tsx              ← main UI with all tabs
  components/
    ChatInterface.tsx          ← streaming chat + provider selector
    PromptTemplates.tsx        ← template CRUD + use
    RagPanel.tsx               ← doc upload + keyword search
    ImageGenPanel.tsx          ← DALL-E / Stability AI
    CodeExecutor.tsx           ← in-browser code runner
    BenchmarkPanel.tsx         ← multi-provider comparison
    UsageDashboard.tsx         ← token/cost charts
    SettingsPanel.tsx          ← API key management
    SearchHistory.tsx          ← sidebar conversation list

server/
  _core/
    multiLLM.ts                ← all provider logic + streaming
    index.ts                   ← SSE /api/stream/chat + code exec endpoint
  routers.ts                   ← all tRPC routes
  db.ts                        ← database queries
  storage.ts                   ← local disk file storage

drizzle/schema.ts              ← all tables including new feature tables
```

---

## Database

Uses MySQL via Drizzle ORM.

Tables:
- `users`, `api_keys`, `user_preferences`
- `conversations`, `messages`, `attachments`
- `prompt_templates` — saved system prompts
- `rag_documents` — chunked uploaded documents  
- `image_generations` — generation history
- `benchmarks` — saved benchmark runs
- `usage_logs`, `response_cache`

---

## Troubleshooting

**Port in use:** App auto-finds the next available port.

**DB connection failed:** App runs without DB (no history/settings). Check `DATABASE_URL` in `.env`.

**Ollama not detected:** Ensure `ollama serve` is running and `OLLAMA_BASE_URL` is correct.

**Streaming not working:** Some reverse proxies buffer SSE. Add `proxy_buffering off;` in nginx.

**Code execution fails:** Requires Python 3 / Node.js installed on the server. TypeScript requires `ts-node`.
