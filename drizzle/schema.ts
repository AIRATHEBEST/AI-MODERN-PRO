import {
  bigint, boolean, integer, jsonb, pgEnum, pgTable,
  real, serial, text, timestamp, varchar,
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role_enum", ["user", "admin"]);
export const testStatusEnum = pgEnum("test_status_enum", ["ok", "failed", "untested"]);
export const themeEnum = pgEnum("theme_enum", ["light", "dark", "system"]);
export const requestTypeEnum = pgEnum("request_type_enum", ["chat", "transcription", "embedding", "image_gen", "code_exec"]);
export const messageRoleEnum = pgEnum("message_role_enum", ["user", "assistant", "system"]);

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── API Keys ──────────────────────────────────────────────────────────────────
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  keyName: varchar("keyName", { length: 128 }).notNull(),
  encryptedKey: text("encryptedKey").notNull(),
  baseUrl: text("baseUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  lastTestedAt: timestamp("lastTestedAt", { withTimezone: true }),
  testStatus: text("testStatus").default("untested").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// ── Conversations ─────────────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 512 }).notNull().default("New Conversation"),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
  systemPrompt: text("systemPrompt"),
  isPinned: boolean("isPinned").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// ── Messages ──────────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
  promptTokens: integer("promptTokens"),
  completionTokens: integer("completionTokens"),
  totalTokens: integer("totalTokens"),
  cachedResponse: boolean("cachedResponse").default(false).notNull(),
  durationMs: integer("durationMs"),
  imageUrls: jsonb("imageUrls").$type<string[]>(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ── Attachments ───────────────────────────────────────────────────────────────
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("messageId"),
  conversationId: integer("conversationId").notNull(),
  userId: integer("userId").notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileType: varchar("fileType", { length: 128 }).notNull(),
  fileSize: bigint("fileSize", { mode: "number" }).notNull(),
  storageKey: text("storageKey").notNull(),
  storageUrl: text("storageUrl").notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

// ── User Preferences ──────────────────────────────────────────────────────────
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  defaultProvider: varchar("defaultProvider", { length: 64 }).default("built-in").notNull(),
  defaultModel: varchar("defaultModel", { length: 128 }),
  systemPrompt: text("systemPrompt"),
  theme: text("theme").default("system").notNull(),
  streamingEnabled: boolean("streamingEnabled").default(true).notNull(),
  cacheEnabled: boolean("cacheEnabled").default(true).notNull(),
  codeSyntaxTheme: varchar("codeSyntaxTheme", { length: 64 }).default("github").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// ── Usage Logs ────────────────────────────────────────────────────────────────
export const usageLogs = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  promptTokens: integer("promptTokens").default(0).notNull(),
  completionTokens: integer("completionTokens").default(0).notNull(),
  totalTokens: integer("totalTokens").default(0).notNull(),
  estimatedCostUsd: real("estimatedCostUsd").default(0).notNull(),
  requestType: text("requestType").default("chat").notNull(),
  durationMs: integer("durationMs"),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type UsageLog = typeof usageLogs.$inferSelect;
export type InsertUsageLog = typeof usageLogs.$inferInsert;

// ── Response Cache ────────────────────────────────────────────────────────────
export const responseCache = pgTable("response_cache", {
  id: serial("id").primaryKey(),
  cacheKey: varchar("cacheKey", { length: 512 }).notNull().unique(),
  provider: varchar("provider", { length: 64 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  promptHash: varchar("promptHash", { length: 64 }).notNull(),
  response: text("response").notNull(),
  promptTokens: integer("promptTokens").default(0).notNull(),
  completionTokens: integer("completionTokens").default(0).notNull(),
  hitCount: integer("hitCount").default(0).notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type ResponseCache = typeof responseCache.$inferSelect;
export type InsertResponseCache = typeof responseCache.$inferInsert;

// ── Prompt Templates ──────────────────────────────────────────────────────────
export const promptTemplates = pgTable("prompt_templates", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  systemPrompt: text("systemPrompt").notNull(),
  userPrompt: text("userPrompt"),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
  tags: jsonb("tags").$type<string[]>(),
  isPublic: boolean("isPublic").default(false).notNull(),
  useCount: integer("useCount").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = typeof promptTemplates.$inferInsert;

// ── RAG Documents ─────────────────────────────────────────────────────────────
export const ragDocuments = pgTable("rag_documents", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 512 }).notNull(),
  content: text("content").notNull(),
  chunkIndex: integer("chunkIndex").default(0).notNull(),
  totalChunks: integer("totalChunks").default(1).notNull(),
  embedding: jsonb("embedding").$type<number[]>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  sourceFile: varchar("sourceFile", { length: 512 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type RagDocument = typeof ragDocuments.$inferSelect;
export type InsertRagDocument = typeof ragDocuments.$inferInsert;

// ── Image Generations ─────────────────────────────────────────────────────────
export const imageGenerations = pgTable("image_generations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  conversationId: integer("conversationId"),
  prompt: text("prompt").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type ImageGeneration = typeof imageGenerations.$inferSelect;
export type InsertImageGeneration = typeof imageGenerations.$inferInsert;

// ── Benchmarks ────────────────────────────────────────────────────────────────
export const benchmarks = pgTable("benchmarks", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  prompt: text("prompt").notNull(),
  results: jsonb("results").$type<Array<{
    provider: string; model: string; response: string;
    durationMs: number; tokens: number; error?: string;
  }>>().notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type Benchmark = typeof benchmarks.$inferSelect;
export type InsertBenchmark = typeof benchmarks.$inferInsert;
