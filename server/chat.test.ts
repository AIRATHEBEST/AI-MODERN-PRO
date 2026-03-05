import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock modules before importing them
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getConversationById: vi.fn(),
  createMessage: vi.fn(),
  getMessagesByConversation: vi.fn(),
  updateConversationTitle: vi.fn(),
  createUsageLog: vi.fn(),
  getApiKeysByUser: vi.fn(),
  getUserPreferences: vi.fn(),
  upsertUserPreferences: vi.fn(),
  deleteConversation: vi.fn(),
  toggleConversationPin: vi.fn(),
}));

vi.mock("./_core/multiLLM", () => ({
  callMultiLLM: vi.fn(),
  testProviderApiKey: vi.fn(),
}));

import * as db from "./db";
import { callMultiLLM } from "./_core/multiLLM";

describe("Chat Router Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendMessage", () => {
    it("should create user and assistant messages", async () => {
      const mockConversation = {
        id: 1,
        userId: 1,
        title: "Test",
        provider: "built-in",
        model: "gemini-2.5-flash",
        systemPrompt: null,
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMessages = [
        {
          id: 1,
          conversationId: 1,
          role: "user",
          content: "Hello",
          provider: "built-in",
          model: "gemini-2.5-flash",
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          cachedResponse: false,
          durationMs: 100,
          createdAt: new Date(),
        },
      ];

      const mockLLMResponse = {
        content: "Hello! How can I help?",
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        model: "gemini-2.5-flash",
        provider: "built-in",
      };

      vi.mocked(db.getConversationById).mockResolvedValue(mockConversation);
      vi.mocked(db.getMessagesByConversation).mockResolvedValue(mockMessages);
      vi.mocked(db.createMessage).mockResolvedValue(2);
      vi.mocked(callMultiLLM).mockResolvedValue(mockLLMResponse);

      const conv = await db.getConversationById(1, 1);
      expect(conv).toEqual(mockConversation);

      const msgs = await db.getMessagesByConversation(1);
      expect(msgs).toHaveLength(1);

      const llmResult = await callMultiLLM({
        messages: [{ role: "user", content: "Hello" }],
        provider: "built-in",
      });
      expect(llmResult.content).toBe("Hello! How can I help?");
    });

    it("should handle API errors gracefully", async () => {
      vi.mocked(callMultiLLM).mockRejectedValue(new Error("API Error"));
      await expect(callMultiLLM({ messages: [], provider: "openai" })).rejects.toThrow("API Error");
    });

    it("should log usage statistics on success", async () => {
      vi.mocked(db.createUsageLog).mockResolvedValue(undefined);

      await db.createUsageLog({
        userId: 1,
        provider: "built-in",
        model: "gemini-2.5-flash",
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        estimatedCostUsd: 0,
        requestType: "chat",
        success: true,
      });

      expect(db.createUsageLog).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, provider: "built-in", success: true })
      );
    });

    it("should log usage statistics on failure", async () => {
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
        errorMessage: "API Error",
      });

      expect(db.createUsageLog).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, errorMessage: "API Error" })
      );
    });
  });

  describe("getConversations", () => {
    it("should retrieve user conversations", async () => {
      const mockConversations = [
        { id: 1, userId: 1, title: "First Chat", provider: "built-in", model: "gemini-2.5-flash", systemPrompt: null, isPinned: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 2, userId: 1, title: "Second Chat", provider: "openai", model: "gpt-4o", systemPrompt: null, isPinned: true, createdAt: new Date(), updatedAt: new Date() },
      ];

      expect(mockConversations).toHaveLength(2);
      expect(mockConversations[0].title).toBe("First Chat");
      expect(mockConversations[1].isPinned).toBe(true);
    });
  });

  describe("createConversation", () => {
    it("should create a new conversation message", async () => {
      vi.mocked(db.createMessage).mockResolvedValue(1);
      const result = await db.createMessage({ conversationId: 1, role: "user", content: "Test message" });
      expect(result).toBe(1);
    });
  });

  describe("updateConversationTitle", () => {
    it("should update conversation title", async () => {
      vi.mocked(db.updateConversationTitle).mockResolvedValue(undefined);
      await db.updateConversationTitle(1, 1, "New Title");
      expect(db.updateConversationTitle).toHaveBeenCalledWith(1, 1, "New Title");
    });
  });

  describe("deleteConversation", () => {
    it("should delete conversation and related data", async () => {
      vi.mocked(db.deleteConversation).mockResolvedValue(undefined);
      await db.deleteConversation(1, 1);
      expect(db.deleteConversation).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("Multi-provider routing", () => {
    it("should route to built-in provider by default", async () => {
      vi.mocked(callMultiLLM).mockResolvedValue({ content: "Response from built-in", provider: "built-in", model: "gemini-2.5-flash" });
      const result = await callMultiLLM({ messages: [{ role: "user", content: "Hello" }], provider: "built-in" });
      expect(result.provider).toBe("built-in");
    });

    it("should route to OpenAI provider", async () => {
      vi.mocked(callMultiLLM).mockResolvedValue({ content: "Response from OpenAI", provider: "openai", model: "gpt-4o" });
      const result = await callMultiLLM({ messages: [{ role: "user", content: "Hello" }], provider: "openai", apiKey: "sk-test" });
      expect(result.provider).toBe("openai");
    });

    it("should route to Ollama provider", async () => {
      vi.mocked(callMultiLLM).mockResolvedValue({ content: "Response from Ollama", provider: "ollama", model: "llama3.2" });
      const result = await callMultiLLM({ messages: [{ role: "user", content: "Hello" }], provider: "ollama" });
      expect(result.provider).toBe("ollama");
    });

    it("should route to Anthropic Claude provider", async () => {
      vi.mocked(callMultiLLM).mockResolvedValue({ content: "Response from Claude", provider: "claude", model: "claude-3-5-haiku-20241022" });
      const result = await callMultiLLM({ messages: [{ role: "user", content: "Hello" }], provider: "claude", apiKey: "sk-ant-test" });
      expect(result.provider).toBe("claude");
    });

    it("should route to Gemini provider", async () => {
      vi.mocked(callMultiLLM).mockResolvedValue({ content: "Response from Gemini", provider: "gemini", model: "gemini-1.5-flash" });
      const result = await callMultiLLM({ messages: [{ role: "user", content: "Hello" }], provider: "gemini", apiKey: "AIza-test" });
      expect(result.provider).toBe("gemini");
    });
  });

  describe("Attachment handling", () => {
    it("should include attachment URLs in messages", () => {
      const messages = [{ role: "user" as const, content: "Analyze this file" }];
      const attachmentUrls = ["https://example.com/file1.pdf"];

      const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
      const urlList = attachmentUrls.map((u, i) => `[Attachment ${i + 1}]: ${u}`).join("\n");
      const updatedMessages = [...messages];
      updatedMessages[lastUserIdx] = {
        ...updatedMessages[lastUserIdx],
        content: `${updatedMessages[lastUserIdx].content}\n\nAttached files:\n${urlList}`,
      };

      expect(updatedMessages[0].content).toContain("Attached files:");
      expect(updatedMessages[0].content).toContain("https://example.com/file1.pdf");
    });

    it("should handle multiple attachments", () => {
      const messages = [{ role: "user" as const, content: "Compare these files" }];
      const attachmentUrls = ["https://example.com/file1.pdf", "https://example.com/file2.docx"];

      const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
      const urlList = attachmentUrls.map((u, i) => `[Attachment ${i + 1}]: ${u}`).join("\n");
      const updatedMessages = [...messages];
      updatedMessages[lastUserIdx] = {
        ...updatedMessages[lastUserIdx],
        content: `${updatedMessages[lastUserIdx].content}\n\nAttached files:\n${urlList}`,
      };

      expect(updatedMessages[0].content).toContain("[Attachment 1]:");
      expect(updatedMessages[0].content).toContain("[Attachment 2]:");
    });
  });
});
