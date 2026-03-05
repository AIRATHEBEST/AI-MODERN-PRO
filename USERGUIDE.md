# AI Assistant App - User Guide

Welcome to the AI Assistant App! This guide will help you get the most out of all available features.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Managing API Keys](#managing-api-keys)
3. [Using the Chat Interface](#using-the-chat-interface)
4. [Working with Files](#working-with-files)
5. [Understanding Providers](#understanding-providers)
6. [Customizing Your Experience](#customizing-your-experience)
7. [Monitoring Usage](#monitoring-usage)
8. [Tips & Best Practices](#tips--best-practices)

## Getting Started

### First Time Setup

1. **Sign In**: Click "Sign in to continue" and authenticate with your Manus account
2. **Create Your First Conversation**: Click "New Chat" in the sidebar
3. **Add an API Key** (Optional): Go to Settings → API Keys to add provider credentials
4. **Start Chatting**: Type your message and press Enter

### Understanding the Interface

The app is divided into three main sections:

- **Sidebar**: Shows conversation history, search, and quick access to new chats
- **Main Chat Area**: Where you type messages and see responses
- **Tabs**: Chat, Settings, and Usage monitoring

## Managing API Keys

### Why Add API Keys?

The app comes with built-in Manus AI models, but you can add your own API keys to:
- Use specific providers (OpenAI, Claude, Gemini, etc.)
- Access more advanced models
- Control costs by using cheaper alternatives
- Use local models via Ollama

### Adding an API Key

1. Go to **Settings** → **API Keys**
2. Click **Add Key**
3. Select a provider from the dropdown
4. Enter a name for this key (e.g., "My OpenAI Key")
5. Paste your API key
6. (Optional) Enter a custom base URL for self-hosted solutions
7. Click **Add Key**

### Testing Your API Key

1. Find the key in the list
2. Click **Test** button
3. Wait for the test to complete
4. A checkmark indicates the key is valid

### Removing an API Key

1. Find the key in the list
2. Click the **Delete** button
3. Confirm deletion

### Getting API Keys

**OpenAI**
- Visit: https://platform.openai.com/api-keys
- Create a new secret key
- Copy and paste into the app

**Anthropic Claude**
- Visit: https://console.anthropic.com/
- Create an API key
- Copy and paste into the app

**Google Gemini**
- Visit: https://makersuite.google.com/app/apikey
- Create a new API key
- Copy and paste into the app

**Ollama (Local)**
- Install from: https://ollama.ai
- Run: `ollama serve`
- Use base URL: `http://localhost:11434`
- No API key needed

**Hugging Face**
- Visit: https://huggingface.co/settings/tokens
- Create a new token
- Copy and paste into the app

## Using the Chat Interface

### Sending Messages

1. Type your message in the text box at the bottom
2. Press **Enter** to send (or Shift+Enter for new line)
3. Click the **Send** button (arrow icon)
4. Wait for the AI response

### Message Features

- **Markdown Support**: Responses support bold, italic, links, code blocks, etc.
- **Code Syntax Highlighting**: Code blocks are automatically highlighted
- **Copy Code**: Hover over code blocks to copy them
- **Auto-scroll**: Chat automatically scrolls to the latest message

### Conversation Management

**Create New Conversation**
- Click **New Chat** in the sidebar
- Each conversation maintains separate context

**Rename Conversation**
- Click on the conversation title in the header
- Edit the name and press Enter

**Pin Conversation**
- Click the pin icon in the conversation list
- Pinned conversations appear at the top

**Delete Conversation**
- Click the trash icon in the conversation list
- Confirm deletion (cannot be undone)

### Provider & Model Selection

1. Click the provider dropdown in the header
2. Select your desired provider
3. Choose a model from the model dropdown
4. Your selection applies to future messages in this conversation

## Working with Files

### Supported File Types

- **Images**: PNG, JPG, GIF, WebP
- **Documents**: PDF, DOCX, TXT, XLSX, CSV
- **Audio**: MP3, WAV, OGG, M4A, WebM

### Uploading Files

**Method 1: Click Upload**
1. Click the **Paperclip** icon in the chat input
2. Select files from your computer
3. Files appear as chips above the input

**Method 2: Drag & Drop**
1. Drag files from your computer
2. Drop them into the chat area
3. Files are automatically uploaded

### File Previews

- **Images**: Click to see full-size preview
- **Audio**: Play audio directly in the app
- **Documents**: View document information

### Audio Transcription

1. Upload an audio file
2. The app automatically transcribes it to text
3. The transcribed text is included in your message to the AI
4. Use this for voice notes, recordings, meetings, etc.

### Removing Uploaded Files

- Click the **X** on the file chip to remove it before sending
- Files are only sent when you click Send

## Understanding Providers

### Built-in (Manus)
- **Cost**: Free with your Manus account
- **Models**: Access to latest models
- **Speed**: Optimized for performance
- **Best for**: General use, no API key needed

### OpenAI
- **Models**: GPT-4, GPT-4 Turbo, GPT-3.5-Turbo
- **Cost**: Varies by model and tokens
- **Strengths**: Advanced reasoning, code generation
- **Best for**: Complex tasks, coding

### Anthropic Claude
- **Models**: Claude 3 Opus, Sonnet, Haiku
- **Cost**: Varies by model
- **Strengths**: Long context, nuanced understanding
- **Best for**: Analysis, writing, reasoning

### Google Gemini
- **Models**: Gemini Pro, Gemini Pro Vision
- **Cost**: Free tier available
- **Strengths**: Multimodal capabilities, fast
- **Best for**: Image analysis, quick responses

### Ollama (Local)
- **Cost**: Free (runs on your computer)
- **Models**: Various open-source models
- **Speed**: Depends on your hardware
- **Best for**: Privacy-sensitive tasks, offline use

### Hugging Face
- **Models**: Thousands of open-source models
- **Cost**: Free tier available
- **Strengths**: Variety, customization
- **Best for**: Experimentation, specific use cases

## Customizing Your Experience

### Theme Settings

1. Go to **Settings** → **Preferences**
2. Select **Theme**:
   - **Light**: Bright interface
   - **Dark**: Dark interface
   - **System**: Matches your OS setting

### Default Provider

1. Go to **Settings** → **Preferences**
2. Select **Default Provider**
3. This provider is used for new conversations

### System Prompt

1. Go to **Settings** → **Preferences**
2. Enter a **System Prompt**
3. This prompt is sent with every message to guide the AI's behavior

**Example System Prompts:**
- "You are a helpful coding assistant. Always provide code examples."
- "You are a creative writer. Use vivid language and storytelling."
- "You are a technical expert. Provide detailed, accurate explanations."

### Response Streaming

1. Go to **Settings** → **Preferences**
2. Toggle **Enable Streaming**
3. When enabled, responses appear word-by-word
4. When disabled, responses appear all at once

### Response Caching

1. Go to **Settings** → **Preferences**
2. Toggle **Enable Response Caching**
3. When enabled, similar questions use cached responses (faster, cheaper)
4. When disabled, every request goes to the API

## Monitoring Usage

### Usage Dashboard

Go to **Usage** tab to see:

- **Total Requests**: Number of API calls made
- **Total Tokens**: Combined input + output tokens
- **Estimated Cost**: Calculated based on provider pricing
- **Usage by Provider**: Pie chart showing provider distribution
- **Daily Trend**: Line chart showing usage over time
- **Provider Details**: Detailed metrics for each provider

### Understanding Tokens

- **Tokens**: Smallest units of text (roughly 4 characters = 1 token)
- **Input Tokens**: Tokens in your message + system prompt
- **Output Tokens**: Tokens in the AI response
- **Total Tokens**: Input + Output

### Cost Tracking

- Costs are estimated based on official provider pricing
- Actual costs may vary based on your pricing tier
- Use the Usage tab to monitor spending

### Setting Budgets

While the app doesn't enforce budgets, you can:
1. Check Usage regularly
2. Set reminders to review costs
3. Use cheaper models for simple tasks
4. Enable caching to reduce API calls

## Tips & Best Practices

### Getting Better Responses

1. **Be Specific**: Detailed prompts get better results
2. **Provide Context**: Include relevant background information
3. **Use Examples**: Show the AI what you want
4. **Break Down Tasks**: Complex tasks work better as multiple steps
5. **Iterate**: Refine responses by asking follow-up questions

### Cost Optimization

1. **Use Ollama Locally**: Free for simple tasks
2. **Choose Appropriate Models**: Smaller models for simple tasks
3. **Enable Caching**: Reuse responses for similar queries
4. **Batch Requests**: Group similar tasks together
5. **Monitor Usage**: Check the Usage tab regularly

### File Handling Tips

1. **Audio Quality**: Clear audio transcribes better
2. **File Size**: Keep files under 16MB
3. **Document Format**: PDFs work best for documents
4. **Image Quality**: High-resolution images analyze better
5. **Multiple Files**: Upload related files together for context

### Conversation Management

1. **Pin Important Conversations**: Keep frequently used ones accessible
2. **Name Conversations**: Use descriptive titles for easy finding
3. **Archive Old Conversations**: Delete completed conversations
4. **Search Effectively**: Use keywords to find conversations

### Productivity Tips

1. **Create Templates**: Use system prompts for recurring tasks
2. **Reuse Conversations**: Continue in existing conversations for context
3. **Combine Providers**: Use different providers for different task types
4. **Automate Workflows**: Chain multiple requests together
5. **Save Outputs**: Copy important responses for later use

## Troubleshooting

### Common Issues

**"API Key Invalid"**
- Verify the key is correct
- Check if the key has expired
- Ensure the key has proper permissions
- Click Test to verify

**"File Upload Failed"**
- Check file size (max 16MB)
- Verify file format is supported
- Try uploading a different file
- Check internet connection

**"No Response from AI"**
- Check if provider is working
- Verify API key is valid
- Check your internet connection
- Try a different provider

**"Streaming Not Working"**
- Enable streaming in Preferences
- Check browser console for errors
- Try disabling and re-enabling
- Refresh the page

### Getting Help

1. Check this guide for your issue
2. Review provider documentation
3. Check browser console (F12) for errors
4. Contact support through Manus dashboard

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift+Enter**: New line in message
- **Escape**: Close dialogs
- **Ctrl/Cmd+K**: Focus search

## Privacy & Security

- Your conversations are stored securely
- API keys are encrypted before storage
- No API keys are logged or exposed
- Your data is isolated to your account
- All communication is encrypted (HTTPS)

## Feedback & Suggestions

We'd love to hear from you!
- Report bugs through the Manus dashboard
- Suggest features for future updates
- Share your use cases and workflows

Happy chatting! 🚀
