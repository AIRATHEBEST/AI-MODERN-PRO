/**
 * Ollama Integration Module
 * Full support for local Ollama models with streaming, file handling, and all features
 */

import { invokeLLM } from "./llm";
import { FileHandler } from "./fileHandler";

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
}

export interface OllamaChatResponse {
  model: string;
  createdAt: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  totalDuration?: number;
  loadDuration?: number;
  promptEvalCount?: number;
  promptEvalDuration?: number;
  evalCount?: number;
  evalDuration?: number;
}

class OllamaClient {
  private baseUrl: string;
  private defaultModel: string;
  private timeout: number;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = config.baseUrl || "http://localhost:11434";
    this.defaultModel = config.model || "llama2";
    this.timeout = config.timeout || 30000;
  }

  /**
   * Check if Ollama service is running
   */
  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getModels(): Promise<OllamaModel[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = (await response.json()) as { models: OllamaModel[] };
      return data.models || [];
    } catch (error) {
      console.error("[Ollama] Failed to get models:", error);
      return [];
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout * 10);
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      console.error(`[Ollama] Failed to pull model ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Send chat request to Ollama
   */
  async chat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: request.messages,
          stream: request.stream ?? false,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP ?? 0.9,
          top_k: request.topK ?? 40,
          repeat_penalty: request.repeatPenalty ?? 1.1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Ollama] Chat request failed:", error);
      throw error;
    }
  }

  /**
   * Stream chat response from Ollama
   */
  async *chatStream(request: OllamaChatRequest): AsyncGenerator<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: request.messages,
          stream: true,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP ?? 0.9,
          top_k: request.topK ?? 40,
          repeat_penalty: request.repeatPenalty ?? 1.1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
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
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line) as OllamaChatResponse;
                if (parsed.message?.content) {
                  yield parsed.message.content;
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
      console.error("[Ollama] Stream request failed:", error);
      throw error;
    }
  }

  /**
   * Process file with Ollama (vision models)
   * Converts file to base64 for vision models
   */
  async processFileWithVision(
    fileBuffer: Buffer,
    fileName: string,
    modelName: string,
    userMessage: string
  ): Promise<string> {
    try {
      const fileType = FileHandler.detectFileType(fileName);

      // Only vision models can process images
      if (!fileType.category.includes("image")) {
        throw new Error(`${fileType.category} files are not supported for vision processing`);
      }

      const base64 = fileBuffer.toString("base64");

      const response = await this.chat({
        model: modelName,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

      return response.message.content;
    } catch (error) {
      console.error("[Ollama] Vision processing failed:", error);
      throw error;
    }
  }

  /**
   * Generate embeddings using Ollama
   */
  async generateEmbeddings(text: string, modelName?: string): Promise<number[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName || this.defaultModel,
          prompt: text,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to generate embeddings: ${response.statusText}`);
      }

      const data = (await response.json()) as { embedding: number[] };
      return data.embedding;
    } catch (error) {
      console.error("[Ollama] Embedding generation failed:", error);
      throw error;
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName: string): Promise<Record<string, unknown> | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`[Ollama] Failed to get model info for ${modelName}:`, error);
      return null;
    }
  }

  /**
   * Delete/unload a model
   */
  async deleteModel(modelName: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(`${this.baseUrl}/api/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      console.error(`[Ollama] Failed to delete model ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Set configuration for Ollama
   */
  setConfig(config: OllamaConfig): void {
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (config.model) this.defaultModel = config.model;
    if (config.timeout) this.timeout = config.timeout;
  }

  /**
   * Get current configuration
   */
  getConfig(): OllamaConfig {
    return {
      baseUrl: this.baseUrl,
      model: this.defaultModel,
      timeout: this.timeout,
    };
  }
}

// Singleton instance
let ollamaClient: OllamaClient | null = null;

export function getOllamaClient(config?: OllamaConfig): OllamaClient {
  if (!ollamaClient) {
    ollamaClient = new OllamaClient(config);
  }
  return ollamaClient;
}

export default OllamaClient;
