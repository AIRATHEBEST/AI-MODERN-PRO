import { ENV } from "./env";

/**
 * Standalone LLM implementation using standard OpenAI-compatible API.
 */
export type Role = "system" | "user" | "assistant" | "tool" | "function";
export type TextContent = { type: "text"; text: string; };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high"; }; };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string; }; };
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = { role: Role; content: MessageContent | MessageContent[]; name?: string; tool_call_id?: string; };
export type InvokeParams = { messages: Message[]; model?: string; maxTokens?: number; };
export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{ index: number; message: { role: Role; content: string; }; finish_reason: string | null; }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number; };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const { messages, model = "gpt-4o-mini" } = params;
  const apiKey = ENV.forgeApiKey || process.env.OPENAI_API_KEY;
  const apiUrl = ENV.forgeApiUrl || "https://api.openai.com/v1/chat/completions";
  if (!apiKey) throw new Error("No LLM API key configured");
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: messages.map(m => ({ role: m.role, content: m.content })) }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }
  return (await response.json()) as InvokeResult;
}
