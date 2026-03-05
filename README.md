# AI MODERN PRO

A full-featured AI assistant web application with real Supabase authentication and PostgreSQL database.

## Features

- **Real Supabase Auth** — Email/password authentication via Supabase
- **PostgreSQL Database** — All data stored in Supabase (conversations, messages, API keys, etc.)
- **Multi-Provider AI** — OpenAI, Claude, Gemini, Deepseek, Grok, HuggingFace, Ollama
- **SSE Streaming** — Real-time streaming responses
- **File Upload** — Attach files to conversations
- **Image Generation** — Generate images with AI
- **RAG Search** — Document-based retrieval augmented generation
- **Code Execution** — Run code snippets
- **Prompt Templates** — Save and reuse prompts
- **Model Benchmarks** — Compare AI providers
- **Export** — Export conversations in multiple formats
- **Dark Mode** — System/light/dark theme support

## Setup

1. Clone the repository
2. Copy `.env` and fill in your values (all Supabase credentials are pre-configured)
3. Install dependencies: `pnpm install`
4. Start the server: `pnpm run start`

## Default User

- **Email:** Ntshongwanae@gmail.com
- **Password:** @960145404

## Environment Variables

All required variables are pre-configured in `.env`:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for server-side operations) |
| `JWT_SECRET` | Secret for signing session cookies |
| `OWNER_OPEN_ID` | Supabase user ID for admin access |

## Tech Stack

- **Frontend:** React + TypeScript + TailwindCSS + tRPC
- **Backend:** Node.js + Express + tRPC
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password)
- **Build:** Vite
