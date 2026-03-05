/**
 * Puter.js Integration - Free AI API
 * No API keys required
 */

export interface PuterChatRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
}

export async function callPuterAI(request: PuterChatRequest): Promise<{
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}> {
  const prompt = request.messages.map(m => `${m.role}: ${m.content}`).join("\n");
  
  const response = await fetch("https://api.puter.com/drivers/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      interface: "puter-chat-completion",
      driver: request.model || "claude-sonnet-4-6",
      method: "complete",
      args: { messages: request.messages }
    })
  });

  if (!response.ok) throw new Error(`Puter API error: ${response.statusText}`);
  
  const data = await response.json();
  return {
    content: data.message?.content?.[0]?.text || data.text || "",
    model: request.model || "claude-sonnet-4-6"
  };
}

export async function* streamPuterAI(request: PuterChatRequest): AsyncGenerator<string> {
  const response = await fetch("https://api.puter.com/drivers/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      interface: "puter-chat-completion",
      driver: request.model || "claude-sonnet-4-6",
      method: "complete",
      args: { messages: request.messages, stream: true }
    })
  });

  if (!response.ok) throw new Error(`Puter API error: ${response.statusText}`);
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) yield parsed.text;
          } catch {}
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
