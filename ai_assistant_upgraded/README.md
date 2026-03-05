# AI Assistant App (Standalone Puter.js Version)

This is a standalone, portable version of the AI Assistant App, integrated with **Puter.js** for cloud features and removed from Manus-specific dependencies.

## Features

- **Multi-Provider LLM**: Supports Puter AI, OpenAI, Anthropic, Gemini, and Ollama.
- **Puter.js Integration**: Uses Puter for authentication, cloud storage, and hosting.
- **File Handling**: Advanced file processing for 100+ file types.
- **Usage Dashboard**: Track your AI usage and costs.
- **Responsive UI**: Modern, clean interface built with React and Tailwind CSS.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- pnpm (recommended) or npm

### Installation

1. Extract the zip file.
2. Install dependencies:
   ```bash
   pnpm install
   ```

### Configuration

Create a `.env` file in the root directory with the following variables:

```env
DATABASE_URL=your_mysql_database_url
JWT_SECRET=your_random_secret_key
LLM_API_KEY=your_openai_or_fallback_api_key
```

### Running the App

#### Development Mode
```bash
pnpm dev
```

#### Production Build
```bash
pnpm build
pnpm start
```

## Standalone Improvements

- **Removed Manus Runtime**: No longer dependent on `vite-plugin-manus-runtime`.
- **Puter.js Auth**: Uses Puter's authentication system for standalone login.
- **Puter.js Storage**: Uses Puter's KV/Storage for file attachments.
- **Express 5 Fixes**: Resolved path-to-regexp issues for modern environments.
- **Enhanced LLM Routing**: Improved multi-provider support with Puter AI fallback.

## License

MIT


---

# 🚀 PRODUCTION FEATURES ENFORCED

✅ Multi-provider AI (OpenAI, Claude, Gemini, Ollama, HuggingFace, DeepSeek, Grok, Puter)
✅ Puter.js support (500+ models)
✅ Ollama configurable base URL
✅ File upload system (extensible for 100+ formats)
✅ Real-time streaming architecture
✅ Code execution interface (server-side execution ready)
✅ Search history & conversation management
✅ Settings panel with API key support
✅ React + TypeScript + Tailwind
✅ tRPC type-safe APIs
✅ MySQL (Drizzle ORM)

To run:

```bash
npm install
cp .env.example .env
npm run dev
```
