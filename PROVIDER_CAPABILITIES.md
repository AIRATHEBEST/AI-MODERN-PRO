# Provider Capabilities - Full Comparison

## File Type Support:

### ✅ Gemini (Best for files)
- **Accepts:** Images, PDFs, Audio, Video, ZIP, RAR, TAR, GZ, Documents, Code
- **Max size:** 20MB per file
- **Best for:** Multi-modal tasks, document analysis

### ✅ Claude (Anthropic)
- **Accepts:** Images, PDFs, Text files, Code
- **Max size:** 10MB per file
- **Best for:** Document analysis, coding

### ✅ OpenAI (GPT-4o)
- **Accepts:** Images, PDFs, Documents, Code
- **Max size:** 20MB per file
- **Best for:** Vision tasks, document analysis

### ⚠️ Deepseek
- **Accepts:** Text files, Code only
- **Best for:** Pure coding tasks

### ⚠️ Grok
- **Accepts:** Text files, Code only
- **Best for:** Real-time information

### ⚠️ Puter (Free)
- **Accepts:** Text files only (no binary)
- **Best for:** Text processing, coding

### ⚠️ Ollama (Local)
- **Accepts:** Text files only
- **Best for:** Privacy, offline use

## Web Search Capabilities:

### 🌐 With Web Search:
1. **Grok** - Real-time Twitter/X data
2. **Claude (with API key)** - Web search enabled
3. **Gemini (with API key)** - Google search integration
4. **OpenAI (with API key)** - Bing search integration

### ❌ No Web Search:
- Puter (free tier)
- Deepseek
- Ollama
- HuggingFace

## ZIP/RAR File Support:

### Can Process Archives:
1. **Gemini** ⭐ - Can read ZIP contents directly
2. **Claude** - Can analyze if you extract first
3. **OpenAI** - Can analyze if you extract first

### Cannot Process Archives:
- Deepseek
- Grok
- Puter
- Ollama
- HuggingFace

## Pro Abilities Summary:

### 🥇 Gemini (Best Overall)
- ✅ All file types including ZIP
- ✅ Web search (with API key)
- ✅ 2M token context
- ✅ Multi-modal (text, image, audio, video)
- ✅ Free tier available

### 🥈 Claude (Best for Coding)
- ✅ Images, PDFs, documents
- ✅ Web search (with API key)
- ✅ 200K token context
- ✅ Best reasoning
- ⚠️ No ZIP support

### 🥉 OpenAI (Best for Vision)
- ✅ Images, PDFs, documents
- ✅ Web search (with API key)
- ✅ Strong multi-modal
- ⚠️ No ZIP support

### Deepseek (Code Specialist)
- ✅ Excellent for coding
- ✅ Fast and cheap
- ❌ Text only
- ❌ No web search

### Grok (Real-time)
- ✅ Real-time Twitter/X data
- ✅ Current events
- ❌ Text only
- ⚠️ Limited file support

### Puter (Free)
- ✅ Completely free
- ✅ No API key needed
- ❌ Text only
- ❌ No web search
- ❌ No archives

## Recommendations:

**For ZIP/RAR files:** Use **Gemini**
**For web search:** Use **Grok** or **Claude** (with API key)
**For documents:** Use **Claude** or **Gemini**
**For coding:** Use **Deepseek** or **Claude**
**For free use:** Use **Puter** (limited features)

## Setup for Pro Features:

1. Go to **Settings** → **API Keys**
2. Add your API key for:
   - **Gemini** (for ZIP files + web search)
   - **Claude** (for documents + web search)
   - **OpenAI** (for vision + web search)
3. Select provider in chat
4. Upload any supported file type

**Note:** Web search requires paid API keys. Free tiers don't include web access.
