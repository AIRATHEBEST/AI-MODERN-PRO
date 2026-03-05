# 🚀 AI Assistant — Setup Guide

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- MySQL 8+ (local or cloud)
- Optional: Ollama for local models

---

## Quick Start (5 minutes)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env` — at minimum set:
```env
DATABASE_URL=mysql://root:password@localhost:3306/ai_assistant
JWT_SECRET=any-random-string-here
```

### 3. Create the database
```bash
# In MySQL:
CREATE DATABASE ai_assistant;
```

Then run migrations:
```bash
pnpm db:push
```

### 4. Start the app
```bash
pnpm dev
```

Open **http://localhost:3000**

---

## Adding AI Providers

### Via Settings Panel (recommended)
1. Open the app → click **Settings** tab
2. Add your API keys for any provider

### Via .env (server-side defaults)
Set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. in `.env`

---

## Provider Setup

### OpenAI
- Get key: https://platform.openai.com/api-keys
- Models: gpt-4o, gpt-4o-mini, o1, o3-mini, etc.

### Anthropic Claude
- Get key: https://console.anthropic.com
- Models: claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5, etc.

### Google Gemini
- Get key: https://makersuite.google.com/app/apikey
- Models: gemini-2.0-flash, gemini-1.5-pro, etc.

### Deepseek
- Get key: https://platform.deepseek.com
- Models: deepseek-chat, deepseek-reasoner, deepseek-coder

### Grok (xAI)
- Get key: https://console.x.ai
- Models: grok-beta, grok-2, grok-2-mini

### Hugging Face
- Get key: https://huggingface.co/settings/tokens
- Models: Mistral, LLaMA, Gemma, Qwen, etc.

### Ollama (Local — no API key needed)
1. Install: https://ollama.ai
2. Pull a model: `ollama pull llama3.2`
3. In Settings, set Base URL to `http://localhost:11434`
4. Models are **auto-detected** — no manual config needed!

### Puter (500+ models — no API key needed in browser)
- Puter.js handles authentication automatically in the browser
- Access to 500+ models for free via https://puter.com
- For server-side Puter, set `PUTER_API_KEY` in .env

---

## Features

| Feature | Description |
|---------|-------------|
| **SSE Streaming** | Real-time token streaming for OpenAI, Claude, Gemini, Ollama, Deepseek, Grok |
| **Stop Generation** | Cancel streaming mid-response with the stop button |
| **Ollama Auto-detect** | Automatically lists your installed Ollama models |
| **File Upload** | Upload images, PDFs, audio, code files, and 100+ other formats |
| **Conversation History** | Searchable chat history with pinning |
| **Usage Dashboard** | Track token usage per provider |
| **Settings Panel** | Manage API keys, set default provider/model, customize system prompts |

---

## Development Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm db:push      # Run DB migrations
pnpm check        # TypeScript check
pnpm test         # Run tests
```

---

## Database Schema

The app uses MySQL with Drizzle ORM. Tables:
- `users` — user accounts
- `conversations` — chat sessions
- `messages` — individual messages with token counts
- `attachments` — uploaded files
- `api_keys` — per-user encrypted API keys
- `user_preferences` — theme, default provider, etc.
- `usage_logs` — token usage tracking

---

## Streaming Architecture

```
Browser → POST /api/stream/chat
         ↓
    Express SSE endpoint
         ↓
    streamMultiLLM() 
    (async generator)
         ↓
    Provider-specific stream
    (OpenAI / Claude / Gemini / Ollama / Deepseek / Grok)
         ↓
    SSE events → Browser
    data: {"type":"delta","content":"Hello"}
    data: {"type":"done",...}
    data: [DONE]
```
