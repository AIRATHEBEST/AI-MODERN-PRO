# Quick Start Guide

## Installation

```bash
pnpm install
```

## Start the Application

### Development Mode (recommended for testing)
```bash
pnpm dev
```

### Production Mode
```bash
pnpm start
```

The app will be available at `http://localhost:3000`

## Login

Use the default credentials:
- **Email:** ntshongwanae@gmail.com
- **Password:** @960145404

## Notes

- `pnpm dev` - Starts development server (faster, auto-reload)
- `pnpm start` - Builds and starts production server
- `pnpm build` - Only builds the frontend

## What's Working

✅ Supabase Authentication (email/password)
✅ PostgreSQL Database via Supabase
✅ Multi-provider AI (OpenAI, Claude, Gemini, etc.)
✅ Real-time SSE streaming
✅ File uploads
✅ Image generation
✅ RAG search
✅ Code execution
✅ Prompt templates
✅ Model benchmarks
✅ Dark mode

## Troubleshooting

If login fails:
1. Make sure you're using `pnpm dev` for development
2. Check that the server is running
3. Verify Supabase credentials in `.env`
4. Use lowercase email: `ntshongwanae@gmail.com`
