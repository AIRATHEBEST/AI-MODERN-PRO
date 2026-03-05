# Puter Issue - Server-Side Blocked

## Problem:
Puter API returns **403 Forbidden** when called from server (Node.js). It only works in browser with user authentication.

## Solution:
Use the **Built-in** provider instead - it has access to multiple models through your configured API.

## What Works Now:

### Built-in Provider (Recommended)
- Uses your `LLM_API_KEY` from `.env`
- Fast responses
- Streaming enabled
- Models: `gpt-4o-mini`, `gpt-4.1-mini`, etc.

### Other Providers (Add API keys in Settings)
- **OpenAI**: gpt-4o, gpt-4o-mini, o3-mini
- **Claude**: claude-opus-4-6, claude-sonnet-4-6
- **Gemini**: gemini-2.0-flash, gemini-1.5-pro
- **Ollama**: Local models (free)
- **Deepseek**: deepseek-chat, deepseek-reasoner
- **Grok**: grok-3, grok-2

## How to Use:

1. **Built-in (Default)** - Already configured, just use it
2. **Add other providers** - Settings → API Keys → Add your keys
3. **Switch anytime** - Top dropdown in chat

## Why Puter Doesn't Work:

Puter requires browser context (cookies, user session). Server-side calls are blocked for security. This is a Puter limitation, not an app issue.

## Recommendation:

Use **Built-in** provider - it's already configured and works perfectly!
