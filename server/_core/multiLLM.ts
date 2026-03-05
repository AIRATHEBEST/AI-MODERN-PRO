/**
 * Multi-Provider LLM Router
 * Supports: OpenAI, Anthropic Claude, Google Gemini, Ollama, Hugging Face, Deepseek, Grok, Puter
 * Features: True SSE streaming, model auto-detection, configurable base URLs
 */

import { ENV } from "./env";

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface LLMRequest {
  messages: ChatMessage[];
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model?: string;
  provider?: string;
}

export type StreamChunk = {
  type: "delta" | "done" | "error";
  content?: string;
  error?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  model?: string;
};

// SSE helper for OpenAI-compatible streams
export async function* parseSSEStream(response: Response): AsyncGenerator<StreamChunk> {
  if (!response.body) throw new Error("No response body for streaming");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === ":") continue;
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            yield { type: "done" };
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield { type: "delta", content: delta };
            if (parsed.usage) {
              yield {
                type: "done",
                usage: {
                  promptTokens: parsed.usage.prompt_tokens,
                  completionTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                },
                model: parsed.model,
              };
              return;
            }
          } catch { /* skip */ }
        }
      }
    }
    yield { type: "done" };
  } finally {
    reader.releaseLock();
  }
}

// Built-in fallback
async function callBuiltIn(req: LLMRequest): Promise<LLMResponse> {
  const apiUrl = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://api.openai.com/v1/chat/completions";
  const apiKey = ENV.forgeApiKey;
  if (!apiKey) throw new Error("Built-in API key not configured");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: req.model || "gpt-4.1-mini", messages: req.messages, max_tokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7 }),
  });
  if (!response.ok) throw new Error(`Built-in LLM error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  return { content: data.choices[0]?.message.content || "", promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens, model: data.model || req.model, provider: "built-in" };
}

// OpenAI
async function callOpenAI(req: LLMRequest): Promise<LLMResponse> {
  if (!req.apiKey) throw new Error("OpenAI API key not provided");
  const baseUrl = (req.baseUrl || "https://api.openai.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({ model: req.model || "gpt-4o-mini", messages: req.messages, max_tokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7 }),
  });
  if (!response.ok) throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  return { content: data.choices[0]?.message.content || "", promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens, model: data.model || req.model, provider: "openai" };
}

export async function* streamOpenAI(req: LLMRequest): AsyncGenerator<StreamChunk> {
  if (!req.apiKey) { yield { type: "error", error: "OpenAI API key not provided" }; return; }
  const baseUrl = (req.baseUrl || "https://api.openai.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({ model: req.model || "gpt-4o-mini", messages: req.messages, max_tokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7, stream: true, stream_options: { include_usage: true } }),
  });
  if (!response.ok) { yield { type: "error", error: `OpenAI error ${response.status}: ${await response.text()}` }; return; }
  yield* parseSSEStream(response);
}

// Anthropic Claude
async function callAnthropic(req: LLMRequest): Promise<LLMResponse> {
  if (!req.apiKey) throw new Error("Anthropic API key not provided");
  const systemMsg = req.messages.find(m => m.role === "system");
  const msgs = req.messages.filter(m => m.role !== "system");
  const body: any = { model: req.model || "claude-3-5-haiku-20241022", max_tokens: req.maxTokens || 4096, messages: msgs };
  if (systemMsg) body.system = systemMsg.content;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": req.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Anthropic error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  const content = data.content?.find((c: any) => c.type === "text")?.text || "";
  return { content, promptTokens: data.usage?.input_tokens, completionTokens: data.usage?.output_tokens, totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0), model: data.model || req.model, provider: "claude" };
}

export async function* streamAnthropic(req: LLMRequest): AsyncGenerator<StreamChunk> {
  if (!req.apiKey) { yield { type: "error", error: "Anthropic API key not provided" }; return; }
  const systemMsg = req.messages.find(m => m.role === "system");
  const msgs = req.messages.filter(m => m.role !== "system");
  const body: any = { model: req.model || "claude-3-5-haiku-20241022", max_tokens: req.maxTokens || 4096, messages: msgs, stream: true };
  if (systemMsg) body.system = systemMsg.content;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": req.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!response.ok) { yield { type: "error", error: `Anthropic error ${response.status}: ${await response.text()}` }; return; }
  if (!response.body) { yield { type: "error", error: "No response body" }; return; }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0, outputTokens = 0;
  let modelName = req.model;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("event:")) continue;
        if (trimmed.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield { type: "delta", content: parsed.delta.text };
            } else if (parsed.type === "message_start") {
              inputTokens = parsed.message?.usage?.input_tokens || 0;
              modelName = parsed.message?.model || modelName;
            } else if (parsed.type === "message_delta") {
              outputTokens = parsed.usage?.output_tokens || 0;
            } else if (parsed.type === "message_stop") {
              yield { type: "done", usage: { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens + outputTokens }, model: modelName };
              return;
            }
          } catch { /* skip */ }
        }
      }
    }
    yield { type: "done" };
  } finally {
    reader.releaseLock();
  }
}

// Google Gemini
async function callGemini(req: LLMRequest): Promise<LLMResponse> {
  if (!req.apiKey) throw new Error("Gemini API key not provided");
  const model = req.model || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${req.apiKey}`;
  const systemMsg = req.messages.find(m => m.role === "system");
  const contents = req.messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const body: any = { contents, generationConfig: { maxOutputTokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7 } };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
  return { content, promptTokens: data.usageMetadata?.promptTokenCount, completionTokens: data.usageMetadata?.candidatesTokenCount, totalTokens: data.usageMetadata?.totalTokenCount, model, provider: "gemini" };
}

export async function* streamGemini(req: LLMRequest): AsyncGenerator<StreamChunk> {
  if (!req.apiKey) { yield { type: "error", error: "Gemini API key not provided" }; return; }
  const model = req.model || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${req.apiKey}`;
  const systemMsg = req.messages.find(m => m.role === "system");
  const contents = req.messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const body: any = { contents, generationConfig: { maxOutputTokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7 } };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) { yield { type: "error", error: `Gemini error ${response.status}: ${await response.text()}` }; return; }
  if (!response.body) { yield { type: "error", error: "No response body" }; return; }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield { type: "delta", content: text };
          if (parsed.candidates?.[0]?.finishReason === "STOP") {
            yield { type: "done", usage: { promptTokens: parsed.usageMetadata?.promptTokenCount, completionTokens: parsed.usageMetadata?.candidatesTokenCount, totalTokens: parsed.usageMetadata?.totalTokenCount }, model };
            return;
          }
        } catch { /* skip */ }
      }
    }
    yield { type: "done" };
  } finally {
    reader.releaseLock();
  }
}

// Ollama
async function callOllama(req: LLMRequest): Promise<LLMResponse> {
  const baseUrl = (req.baseUrl || "http://localhost:11434").replace(/\/$/, "");
  const model = req.model || "llama3.2";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: req.messages, stream: false, options: { temperature: req.temperature ?? 0.7, num_predict: req.maxTokens || 4096 } }),
  });
  if (!response.ok) throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  const promptTokens = data.prompt_eval_count || 0;
  const completionTokens = data.eval_count || 0;
  return { content: data.message?.content || "", promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, model: data.model || model, provider: "ollama" };
}

export async function* streamOllama(req: LLMRequest): AsyncGenerator<StreamChunk> {
  const baseUrl = (req.baseUrl || "http://localhost:11434").replace(/\/$/, "");
  const model = req.model || "llama3.2";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: req.messages, stream: true, options: { temperature: req.temperature ?? 0.7, num_predict: req.maxTokens || 4096 } }),
  });
  if (!response.ok) { yield { type: "error", error: `Ollama error ${response.status}: ${await response.text()}` }; return; }
  if (!response.body) { yield { type: "error", error: "No response body" }; return; }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as any;
          if (parsed.message?.content) yield { type: "delta", content: parsed.message.content };
          if (parsed.done) {
            yield { type: "done", usage: { promptTokens: parsed.prompt_eval_count, completionTokens: parsed.eval_count, totalTokens: (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0) }, model: parsed.model || model };
            return;
          }
        } catch { /* skip */ }
      }
    }
    yield { type: "done" };
  } finally {
    reader.releaseLock();
  }
}

// Ollama model auto-detection
export async function detectOllamaModels(baseUrl: string = "http://localhost:11434"): Promise<Array<{ name: string; size: number; modifiedAt: string }>> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    const data = await response.json() as any;
    return (data.models || []).map((m: any) => ({ name: m.name, size: m.size, modifiedAt: m.modified_at }));
  } catch { return []; }
}

export async function isOllamaRunning(baseUrl: string = "http://localhost:11434"): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch { return false; }
}

// Hugging Face
async function callHuggingFace(req: LLMRequest): Promise<LLMResponse> {
  if (!req.apiKey) throw new Error("Hugging Face API key not provided");
  const model = req.model || "mistralai/Mistral-7B-Instruct-v0.3";
  const response = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({ model, messages: req.messages, max_tokens: req.maxTokens || 2048, temperature: req.temperature ?? 0.7 }),
  });
  if (!response.ok) throw new Error(`Hugging Face error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  return { content: data.choices[0]?.message.content || "", promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens, model, provider: "huggingface" };
}

// Deepseek
async function callDeepseek(req: LLMRequest): Promise<LLMResponse> {
  if (!req.apiKey) throw new Error("Deepseek API key not provided");
  const baseUrl = (req.baseUrl || "https://api.deepseek.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({ model: req.model || "deepseek-chat", messages: req.messages, max_tokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7 }),
  });
  if (!response.ok) throw new Error(`Deepseek error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  return { content: data.choices[0]?.message.content || "", promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens, model: data.model || req.model, provider: "deepseek" };
}

export async function* streamDeepseek(req: LLMRequest): AsyncGenerator<StreamChunk> {
  if (!req.apiKey) { yield { type: "error", error: "Deepseek API key not provided" }; return; }
  const baseUrl = (req.baseUrl || "https://api.deepseek.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({ model: req.model || "deepseek-chat", messages: req.messages, max_tokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7, stream: true }),
  });
  if (!response.ok) { yield { type: "error", error: `Deepseek error ${response.status}: ${await response.text()}` }; return; }
  yield* parseSSEStream(response);
}

// Grok (xAI)
async function callGrok(req: LLMRequest): Promise<LLMResponse> {
  if (!req.apiKey) throw new Error("Grok API key not provided");
  const baseUrl = (req.baseUrl || "https://api.x.ai").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({ model: req.model || "grok-beta", messages: req.messages, max_tokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7 }),
  });
  if (!response.ok) throw new Error(`Grok error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  return { content: data.choices[0]?.message.content || "", promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens, model: data.model || req.model, provider: "grok" };
}

export async function* streamGrok(req: LLMRequest): AsyncGenerator<StreamChunk> {
  if (!req.apiKey) { yield { type: "error", error: "Grok API key not provided" }; return; }
  const baseUrl = (req.baseUrl || "https://api.x.ai").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({ model: req.model || "grok-beta", messages: req.messages, max_tokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7, stream: true }),
  });
  if (!response.ok) { yield { type: "error", error: `Grok error ${response.status}: ${await response.text()}` }; return; }
  yield* parseSSEStream(response);
}

// Puter - server-side via REST API if key exists
async function callPuter(req: LLMRequest): Promise<LLMResponse> {
  const apiKey = req.apiKey || process.env.PUTER_API_KEY;
  if (!apiKey) throw new Error("Puter server-side requires PUTER_API_KEY. Use browser puter.js for free access.");
  const baseUrl = (req.baseUrl || "https://api.puter.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: req.model || "gpt-4o-mini", messages: req.messages, max_tokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7 }),
  });
  if (!response.ok) throw new Error(`Puter error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  return { content: data.choices?.[0]?.message?.content || "", promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens, model: data.model || req.model, provider: "puter" };
}

export async function* streamPuter(req: LLMRequest): AsyncGenerator<StreamChunk> {
  const apiKey = req.apiKey || process.env.PUTER_API_KEY;
  if (!apiKey) { yield { type: "error", error: "Puter server-side streaming requires PUTER_API_KEY" }; return; }
  const baseUrl = (req.baseUrl || "https://api.puter.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: req.model || "gpt-4o-mini", messages: req.messages, max_tokens: req.maxTokens || 4096, temperature: req.temperature ?? 0.7, stream: true }),
  });
  if (!response.ok) { yield { type: "error", error: `Puter error ${response.status}: ${await response.text()}` }; return; }
  yield* parseSSEStream(response);
}

// Main dispatcher
export async function callMultiLLM(req: LLMRequest): Promise<LLMResponse> {
  const provider = req.provider || "built-in";
  switch (provider) {
    case "openai": return callOpenAI(req);
    case "claude": case "anthropic": return callAnthropic(req);
    case "gemini": return callGemini(req);
    case "ollama": return callOllama(req);
    case "huggingface": return callHuggingFace(req);
    case "deepseek": return callDeepseek(req);
    case "grok": return callGrok(req);
    case "puter": return callPuter(req);
    default: return callBuiltIn(req);
  }
}

// Stream dispatcher
export function streamMultiLLM(req: LLMRequest): AsyncGenerator<StreamChunk> {
  const provider = req.provider || "built-in";
  switch (provider) {
    case "openai": return streamOpenAI(req);
    case "claude": case "anthropic": return streamAnthropic(req);
    case "gemini": return streamGemini(req);
    case "ollama": return streamOllama(req);
    case "deepseek": return streamDeepseek(req);
    case "grok": return streamGrok(req);
    case "puter": return streamPuter(req);
    default:
      return (async function* () {
        const result = await callMultiLLM(req);
        yield { type: "delta" as const, content: result.content };
        yield { type: "done" as const, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens }, model: result.model };
      })();
  }
}

export async function testProviderApiKey(provider: string, apiKey: string, baseUrl?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await callMultiLLM({ messages: [{ role: "user", content: "Say OK." }], provider, apiKey, baseUrl, maxTokens: 10 });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Test failed" };
  }
}

export const PROVIDER_METADATA = {
  "built-in": { name: "Built-in", icon: "⚡", models: ["gpt-4.1-mini", "gpt-4.1-nano", "gemini-2.5-flash"], requiresKey: false },
  openai: { name: "OpenAI", icon: "🔑", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"], requiresKey: true },
  claude: { name: "Anthropic Claude", icon: "🧠", models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"], requiresKey: true },
  gemini: { name: "Google Gemini", icon: "✨", models: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"], requiresKey: true },
  ollama: { name: "Ollama (Local)", icon: "🦙", models: [], requiresKey: false },
  huggingface: { name: "Hugging Face", icon: "🤗", models: ["mistralai/Mistral-7B-Instruct-v0.3", "meta-llama/Llama-3.1-8B-Instruct", "google/gemma-2-9b-it", "Qwen/Qwen2.5-7B-Instruct"], requiresKey: true },
  deepseek: { name: "Deepseek", icon: "🔍", models: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"], requiresKey: true },
  grok: { name: "Grok (xAI)", icon: "🤖", models: ["grok-beta", "grok-vision-beta", "grok-2", "grok-2-mini"], requiresKey: true },
  puter: { name: "Puter (500+ Models)", icon: "☁️", models: ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", "claude-3-haiku", "gemini-1.5-flash", "gemini-1.5-pro", "llama-3.1-70b", "mistral-large"], requiresKey: false, note: "Free via puter.js — no API key needed in browser" },
} as const;
