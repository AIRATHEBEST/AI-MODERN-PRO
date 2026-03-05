# AI MODERN PRO

A production-ready AI assistant with Supabase authentication and multi-provider support.

## Quick Start

```bash
pnpm install
pnpm start
```

Open `http://localhost:3000` and login with:
- **Email:** ntshongwanae@gmail.com
- **Password:** @960145404

## Features

- **Supabase Auth** — Email/password authentication
- **PostgreSQL** — Supabase database for all data
- **Multi-Provider AI** — OpenAI, Claude, Gemini, Deepseek, Grok, HuggingFace, Ollama
- **SSE Streaming** — Real-time AI responses
- **File Upload** — Attach files to conversations
- **Image Generation** — AI-powered image creation
- **RAG Search** — Document retrieval
- **Code Execution** — Run code snippets
- **Prompt Templates** — Save and reuse prompts
- **Benchmarks** — Compare AI models
- **Export** — Download conversations
- **Dark Mode** — Theme support

## Tech Stack

- **Frontend:** React + TypeScript + TailwindCSS + tRPC
- **Backend:** Node.js + Express + tRPC
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Build:** Vite

## Environment

All Supabase credentials are pre-configured in `.env`. The default user is created automatically on first startup.

## Scripts

- `pnpm start` — Start production server
- `pnpm dev` — Start development server
- `pnpm build` — Build for production
