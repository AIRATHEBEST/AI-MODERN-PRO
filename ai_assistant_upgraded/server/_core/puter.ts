/**
 * Puter.js Integration Module
 * Provides access to Puter's 500+ AI models and cloud storage
 */

import { ENV } from "./env";


export interface PuterConfig {
  apiKey?: string;
  appId?: string;
  baseUrl?: string;
}

export interface PuterModel {
  id: string;
  name: string;
  provider: string;
  type: "text" | "image" | "audio" | "video";
  description?: string;
}

export interface PuterChatRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface PuterChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finishReason: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class PuterClient {
  private baseUrl: string;
  private apiKey: string;
  private appId: string;

  constructor(config: PuterConfig = {}) {
    this.baseUrl = config.baseUrl || "https://api.puter.com";
    this.apiKey = config.apiKey || process.env.PUTER_API_KEY || "";
    this.appId = config.appId || process.env.PUTER_APP_ID || "";
  }

  /**
   * Get list of available models from Puter
   */
  async getModels(): Promise<PuterModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Puter] Failed to get models:", error);
      return [];
    }
  }

  /**
   * Send chat request to Puter AI model
   */
  async chat(request: PuterChatRequest): Promise<PuterChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2000,
          stream: request.stream ?? false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Puter API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Puter] Chat request failed:", error);
      throw error;
    }
  }

  /**
   * Stream chat response from Puter
   */
  async *chatStream(request: PuterChatRequest): AsyncGenerator<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2000,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Puter API error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

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
              const data = line.slice(6);
              if (data === "[DONE]") break;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  yield content;
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error("[Puter] Stream request failed:", error);
      throw error;
    }
  }

  /**
   * Upload file to Puter cloud storage
   */
  async uploadFile(
    fileName: string,
    fileBuffer: Buffer | Uint8Array,
    mimeType: string
  ): Promise<{ url: string; fileId: string }> {
    try {
      let body: Uint8Array | string;
      if (fileBuffer instanceof Buffer) {
        body = new Uint8Array(fileBuffer);
      } else {
        body = fileBuffer;
      }

      const response = await fetch(`${this.baseUrl}/files/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": mimeType,
        },
        body: body as any,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = (await response.json()) as { url: string; id: string };
      return {
        url: data.url,
        fileId: data.id,
      };
    } catch (error) {
      console.error("[Puter] File upload failed:", error);
      throw error;
    }
  }

  /**
   * Get file from Puter cloud storage
   */
  async getFile(fileId: string): Promise<Uint8Array> {
    try {
      const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get file: ${response.statusText}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      console.error("[Puter] File retrieval failed:", error);
      throw error;
    }
  }

  /**
   * Delete file from Puter cloud storage
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }
      return true;
    } catch (error) {
      console.error("[Puter] File deletion failed:", error);
      return false;
    }
  }

  /**
   * Check Puter service health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let puterClient: PuterClient | null = null;

export function getPuterClient(config?: PuterConfig): PuterClient {
  if (!puterClient) {
    puterClient = new PuterClient(config);
  }
  return puterClient;
}

export default PuterClient;

/**
 * Puter is optional - if no API key is configured, the client will still work
 * but requests to Puter will fail. Users can configure Puter by setting
 * PUTER_API_KEY and PUTER_APP_ID environment variables.
 */
