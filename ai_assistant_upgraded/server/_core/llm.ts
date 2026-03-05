import { ENV } from "./env";
import puter from 'puter';

/**
 * Standalone LLM implementation using Puter.js or standard OpenAI-compatible API.
 * This replaces the Manus-specific Forge API logic.
 */

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: string;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type InvokeParams = {
  messages: Message[];
  model?: string;
  maxTokens?: number;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const { messages, model = "gpt-4o-mini" } = params;

  // 1. Try Puter.js AI if available
  try {
    // Puter.js has a built-in AI chat completion
    const response = await puter.ai.chat(
      messages.map(m => ({
        role: m.role as any,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      })),
      { model }
    );

    if (response) {
      return {
        id: `puter-${Date.now()}`,
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: typeof response === 'string' ? response : (response as any).message?.content || ""
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    }
  } catch (error) {
    console.warn("[LLM] Puter AI failed, falling back to OpenAI-compatible API:", error);
  }

  // 2. Fallback to standard OpenAI-compatible API
  const apiKey = ENV.forgeApiKey || process.env.OPENAI_API_KEY;
  const apiUrl = ENV.forgeApiUrl || "https://api.openai.com/v1/chat/completions";

  if (!apiKey) {
    throw new Error("No LLM API key configured (Puter AI failed and no fallback key found)");
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}
