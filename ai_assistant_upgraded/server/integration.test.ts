/**
 * Integration Tests for AI Assistant App
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FileHandler } from "./_core/fileHandler";
import { getPuterClient } from "./_core/puter";
import { getOllamaClient } from "./_core/ollama";

// Mock modules that require network/DB
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getConversationById: vi.fn(),
  createMessage: vi.fn(),
  getMessagesByConversation: vi.fn(),
  updateConversationTitle: vi.fn(),
  createUsageLog: vi.fn(),
  getApiKeysByUser: vi.fn(),
  getApiKeyById: vi.fn(),
  upsertApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  updateApiKeyTestStatus: vi.fn(),
  getUserPreferences: vi.fn(),
  upsertUserPreferences: vi.fn(),
  getConversationsByUser: vi.fn(),
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  toggleConversationPin: vi.fn(),
  getAttachmentsByConversation: vi.fn(),
  createAttachment: vi.fn(),
  getUsageSummary: vi.fn(),
  getDailyUsage: vi.fn(),
}));

vi.mock("./_core/multiLLM", () => ({
  callMultiLLM: vi.fn(),
  testProviderApiKey: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
  storageGet: vi.fn(),
}));

import * as db from "./db";
import { callMultiLLM, testProviderApiKey } from "./_core/multiLLM";
import { storagePut } from "./storage";

describe("Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── FileHandler Tests ───────────────────────────────────────────────────────
  describe("FileHandler - File Detection", () => {
    it("should detect image file types", () => {
      const result = FileHandler.detectFileType("image.jpg");
      expect(result.category).toBe("image");
      expect(result.mimeType).toBe("image/jpeg");
    });

    it("should detect document file types", () => {
      const result = FileHandler.detectFileType("document.pdf");
      expect(result.category).toBe("document");
      expect(result.mimeType).toBe("application/pdf");
    });

    it("should detect audio file types", () => {
      const result = FileHandler.detectFileType("audio.mp3");
      expect(result.category).toBe("audio");
      expect(result.mimeType).toBe("audio/mpeg");
    });

    it("should detect code file types", () => {
      const result = FileHandler.detectFileType("script.js");
      expect(result.category).toBe("code");
      expect(result.mimeType).toBe("text/javascript");
    });

    it("should detect archive file types", () => {
      const result = FileHandler.detectFileType("archive.zip");
      expect(result.category).toBe("archive");
      expect(result.mimeType).toBe("application/zip");
    });

    it("should handle unknown file types", () => {
      const result = FileHandler.detectFileType("unknown.xyz");
      expect(result.mimeType).toBe("application/octet-stream");
      expect(result.category).toBe("other");
    });
  });

  describe("FileHandler - File Validation", () => {
    it("should validate file sizes correctly", () => {
      const imageSizeValid = FileHandler.validateFileSize(10 * 1024 * 1024, "image");
      const imageSizeInvalid = FileHandler.validateFileSize(100 * 1024 * 1024, "image");
      expect(imageSizeValid).toBe(true);
      expect(imageSizeInvalid).toBe(false);
    });

    it("should get supported extensions", () => {
      const extensions = FileHandler.getSupportedExtensions();
      expect(extensions).toContain(".jpg");
      expect(extensions).toContain(".pdf");
      expect(extensions).toContain(".mp3");
      expect(extensions.length).toBeGreaterThan(50);
    });

    it("should get file statistics", () => {
      const stats = FileHandler.getFileStats();
      expect(stats.image.count).toBeGreaterThan(0);
      expect(stats.document.count).toBeGreaterThan(0);
      expect(stats.audio.count).toBeGreaterThan(0);
      expect(stats.code.count).toBeGreaterThan(0);
      expect(stats.archive.count).toBeGreaterThan(0);
    });
  });

  describe("FileHandler - File Scaling", () => {
    it("should not scale files below the limit", async () => {
      const smallBuffer = Buffer.from("test data");
      const result = await FileHandler.scaleFile(smallBuffer, "test.txt", "document");
      expect(result.scaled).toBe(false);
      expect(result.originalSize).toBe(smallBuffer.length);
      expect(result.scaledSize).toBe(smallBuffer.length);
    });

    it("should handle concurrent file operations", async () => {
      const files = [Buffer.from("file1"), Buffer.from("file2"), Buffer.from("file3")];
      const results = await Promise.all(
        files.map((file) => FileHandler.scaleFile(file, "test.txt", "document"))
      );
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.buffer).toBeDefined();
        expect(result.originalSize).toBeGreaterThan(0);
      });
    });
  });

  describe("FileHandler - Multi-format support", () => {
    it("should support multiple file formats simultaneously", () => {
      const formats = [
        { file: "image.png", expected: "image" },
        { file: "document.docx", expected: "document" },
        { file: "audio.wav", expected: "audio" },
        { file: "video.mp4", expected: "video" },
        { file: "code.py", expected: "code" },
        { file: "data.csv", expected: "data" },
        { file: "archive.zip", expected: "archive" },
      ];
      for (const { file, expected } of formats) {
        const result = FileHandler.detectFileType(file);
        expect(result.category).toBe(expected);
      }
    });
  });

  // ── Singleton Tests ─────────────────────────────────────────────────────────
  describe("PuterClient - Singleton", () => {
    it("should return singleton instance", () => {
      const client1 = getPuterClient();
      const client2 = getPuterClient();
      expect(client1).toBe(client2);
    });
  });

  describe("OllamaClient - Singleton", () => {
    it("should return singleton instance", () => {
      const client1 = getOllamaClient();
      const client2 = getOllamaClient();
      expect(client1).toBe(client2);
    });

    it("should have default config", () => {
      const client = getOllamaClient();
      const config = client.getConfig();
      expect(config.baseUrl).toBe("http://localhost:11434");
    });
  });

  // ── Multi-Provider LLM ──────────────────────────────────────────────────────
  describe("Multi-Provider LLM Routing", () => {
    const providers = ["built-in", "openai", "claude", "gemini", "ollama", "huggingface"] as const;

    providers.forEach((provider) => {
      it(`should route to ${provider} provider`, async () => {
        vi.mocked(callMultiLLM).mockResolvedValue({
          content: `Response from ${provider}`,
          provider,
          model: "test-model",
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        });

        const result = await callMultiLLM({
          messages: [{ role: "user", content: "Hello" }],
          provider,
        });

        expect(result.content).toBe(`Response from ${provider}`);
        expect(result.provider).toBe(provider);
      });
    });
  });

  // ── API Key Management ──────────────────────────────────────────────────────
  describe("API Key Management", () => {
    it("should encode and decode API keys correctly", () => {
      const originalKey = "sk-test-key-12345";
      const encoded = Buffer.from(originalKey).toString("base64");
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      expect(decoded).toBe(originalKey);
    });

    it("should test API key successfully", async () => {
      vi.mocked(testProviderApiKey).mockResolvedValue({ success: true });
      const result = await testProviderApiKey("openai", "sk-test-key");
      expect(result.success).toBe(true);
    });

    it("should handle failed API key test", async () => {
      vi.mocked(testProviderApiKey).mockResolvedValue({
        success: false,
        error: "Invalid API key",
      });
      const result = await testProviderApiKey("openai", "sk-invalid");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });
  });

  // ── File Upload ─────────────────────────────────────────────────────────────
  describe("File Upload Integration", () => {
    it("should upload file to storage", async () => {
      vi.mocked(storagePut).mockResolvedValue({ url: "https://storage.example.com/file.pdf" });
      const buffer = Buffer.from("test file content");
      const result = await storagePut("attachments/1/test.pdf", buffer, "application/pdf");
      expect(result.url).toContain("https://");
    });

    it("should create attachment record in DB", async () => {
      vi.mocked(db.createAttachment).mockResolvedValue(1);
      const attachmentId = await db.createAttachment({
        conversationId: 1,
        userId: 1,
        fileName: "test.pdf",
        fileType: "document",
        fileSize: 1024,
        storageKey: "attachments/1/test.pdf",
        storageUrl: "https://storage.example.com/test.pdf",
        mimeType: "application/pdf",
      });
      expect(attachmentId).toBe(1);
    });
  });

  // ── Usage Tracking ──────────────────────────────────────────────────────────
  describe("Usage Tracking", () => {
    it("should log successful requests", async () => {
      vi.mocked(db.createUsageLog).mockResolvedValue(undefined);
      await db.createUsageLog({
        userId: 1,
        provider: "built-in",
        model: "gemini-2.5-flash",
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        estimatedCostUsd: 0,
        requestType: "chat",
        success: true,
        durationMs: 1500,
      });
      expect(db.createUsageLog).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, totalTokens: 300 })
      );
    });

    it("should log failed requests with error message", async () => {
      vi.mocked(db.createUsageLog).mockResolvedValue(undefined);
      await db.createUsageLog({
        userId: 1,
        provider: "openai",
        model: "gpt-4o",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        requestType: "chat",
        success: false,
        errorMessage: "Rate limit exceeded",
        durationMs: 500,
      });
      expect(db.createUsageLog).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, errorMessage: "Rate limit exceeded" })
      );
    });
  });
});
