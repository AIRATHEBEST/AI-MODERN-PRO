# Configuration Guide

This document explains all environment variables and configuration options for the AI Assistant App.

## Database Configuration

```
DATABASE_URL=mysql://user:password@localhost:3306/ai_assistant
```

Connection string for MySQL database. Format: `mysql://[user]:[password]@[host]:[port]/[database]`

## Authentication & Security

```
JWT_SECRET=your-secret-key-here-change-in-production
```

Secret key for signing JWT tokens. Use a strong, random string in production.

## Manus OAuth (Required)

These are automatically provided by Manus platform:

- `VITE_APP_ID`: Your application ID
- `OAUTH_SERVER_URL`: OAuth server URL (https://api.manus.im)
- `VITE_OAUTH_PORTAL_URL`: Login portal URL
- `OWNER_OPEN_ID`: Your Manus user ID
- `OWNER_NAME`: Your name
- `BUILT_IN_FORGE_API_URL`: Manus API endpoint
- `BUILT_IN_FORGE_API_KEY`: Manus API key
- `VITE_FRONTEND_FORGE_API_KEY`: Frontend API key
- `VITE_FRONTEND_FORGE_API_URL`: Frontend API URL

## Puter.js Integration (Optional)

```
PUTER_API_KEY=your-puter-api-key
PUTER_APP_ID=your-puter-app-id
```

Get your API key from [puter.com/api](https://puter.com/api). This enables access to 500+ AI models and cloud storage.

## Ollama Configuration (Optional)

```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama2
```

Configure local Ollama instance. Default assumes Ollama running on localhost:11434.

### Supported Ollama Models

- `llama2` - Meta's Llama 2 (7B, 13B, 70B variants)
- `mistral` - Mistral 7B
- `neural-chat` - Intel Neural Chat
- `dolphin-mixtral` - Dolphin Mixtral
- `orca-mini` - Orca Mini
- `vicuna` - Vicuna
- `zephyr` - Zephyr
- `neural-chat` - Neural Chat
- `starling-lm` - Starling LM

Pull models with: `ollama pull [model-name]`

## LLM Provider Configuration (Optional)

### OpenAI

```
OPENAI_API_KEY=sk-your-key-here
```

Get from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Anthropic Claude

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get from [console.anthropic.com](https://console.anthropic.com)

### Google Gemini

```
GOOGLE_API_KEY=your-google-api-key
```

Get from [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

### Hugging Face

```
HUGGINGFACE_API_KEY=hf_your-key-here
```

Get from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

### Deepseek

```
DEEPSEEK_API_KEY=sk-your-key-here
```

Get from [platform.deepseek.com](https://platform.deepseek.com)

### Grok (xAI)

```
GROK_API_KEY=your-grok-key-here
```

Get from [grok.x.ai](https://grok.x.ai)

## Application Settings

```
NODE_ENV=development           # development or production
VITE_APP_TITLE=AI Assistant    # Application title
VITE_APP_LOGO=https://...      # Logo URL
PORT=3000                      # Server port
HOST=localhost                 # Server host
```

## File Upload Settings

```
MAX_FILE_SIZE=104857600        # Maximum file size in bytes (100MB)
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx,txt,mp3,wav,zip
```

## Rate Limiting

```
RATE_LIMIT_WINDOW=900000       # Time window in milliseconds (15 minutes)
RATE_LIMIT_MAX_REQUESTS=100    # Max requests per window
```

## Caching

```
CACHE_TTL=3600                 # Cache time-to-live in seconds (1 hour)
CACHE_MAX_SIZE=1000            # Maximum number of cached responses
```

## Analytics (Optional)

```
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

## Logging

```
LOG_LEVEL=info                 # debug, info, warn, error
LOG_FILE=./logs/app.log        # Log file path
```

## Supported File Formats

### Images (50MB limit)
- JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, ICO, HEIC

### Documents (100MB limit)
- PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, MD, RTF, ODT, ODS, ODP

### Audio (500MB limit)
- MP3, WAV, FLAC, AAC, OGG, M4A, WMA, OPUS

### Video (2GB limit)
- MP4, AVI, MOV, MKV, FLV, WMV, WebM, M3U8, 3GP

### Code (50MB limit)
- JS, TS, TSX, JSX, PY, JAVA, CPP, C, GO, RS, PHP, RB, SH, SQL, HTML, CSS, JSON, XML, YAML, TOML

### Data (500MB limit)
- CSV, TSV, JSON, Parquet, Avro

### Archives (1GB limit)
- ZIP, RAR, 7Z, TAR, GZ, BZ2, XZ

## Quick Start

1. Copy configuration template:
   ```bash
   cp CONFIG.md .env.local
   ```

2. Edit `.env.local` with your values

3. Set required Manus variables (provided by platform)

4. (Optional) Add API keys for external providers

5. (Optional) Configure Ollama for local models

6. Start the application:
   ```bash
   pnpm dev
   ```

## Production Deployment

For production, ensure:

1. `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Use HTTPS URLs
4. Set appropriate `RATE_LIMIT_*` values
5. Configure proper logging
6. Use environment-specific API keys
7. Enable CORS if needed
8. Set up database backups
9. Monitor logs and errors
10. Use a reverse proxy (nginx/Apache)

## Troubleshooting

### Ollama Connection Failed
- Ensure Ollama is running: `ollama serve`
- Check `OLLAMA_BASE_URL` is correct
- Verify firewall allows port 11434

### API Key Errors
- Verify API key format and validity
- Check key has required permissions
- Ensure no extra spaces in `.env` file

### File Upload Issues
- Check `MAX_FILE_SIZE` setting
- Verify file type in `ALLOWED_FILE_TYPES`
- Ensure S3 credentials are valid

### Database Connection Failed
- Verify `DATABASE_URL` format
- Check MySQL server is running
- Verify user has database access
- Check firewall allows port 3306

For more help, see the [README.md](./README.md) and [USERGUIDE.md](./USERGUIDE.md).
