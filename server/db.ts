/**
 * Database layer using Supabase REST API client.
 * Column names match the existing Supabase schema (camelCase).
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

// ── Types ─────────────────────────────────────────────────────────────────────
export type User = {
  id: number;
  openId: string;
  name: string;
  email: string | null;
  loginMethod: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date | null;
};
export type InsertUser = Partial<User> & { openId: string };

export type ApiKey = {
  id: number;
  userId: number;
  provider: string;
  keyName: string;
  encryptedKey: string;
  baseUrl: string | null;
  isActive: boolean;
  testStatus: string | null;
  lastTestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type InsertApiKey = Partial<ApiKey> & { userId: number; provider: string; keyName: string; encryptedKey: string };

export type Conversation = {
  id: number;
  userId: number;
  title: string;
  provider: string | null;
  model: string | null;
  systemPrompt: string | null;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};
export type InsertConversation = Partial<Conversation> & { userId: number; title: string };

export type Message = {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  provider: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedResponse: boolean;
  durationMs: number | null;
  imageUrls: string[] | null;
  createdAt: Date;
};
export type InsertMessage = Partial<Message> & { conversationId: number; role: string; content: string };

export type Attachment = {
  id: number;
  conversationId: number;
  userId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  storageUrl: string;
  mimeType: string;
  createdAt: Date;
};
export type InsertAttachment = Partial<Attachment> & { conversationId: number; userId: number; fileName: string; fileType: string; fileSize: number; storageKey: string; storageUrl: string; mimeType: string };

export type UserPreference = {
  id: number;
  userId: number;
  defaultProvider: string;
  defaultModel: string | null;
  systemPrompt: string | null;
  theme: string;
  streamingEnabled: boolean;
  cacheEnabled: boolean;
  codeSyntaxTheme: string;
  createdAt: Date;
  updatedAt: Date;
};
export type InsertUserPreference = Partial<UserPreference> & { userId: number };

export type UsageLog = {
  id: number;
  userId: number;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  requestType: string;
  success: boolean;
  errorMessage: string | null;
  durationMs: number;
  createdAt: Date;
};
export type InsertUsageLog = Partial<UsageLog> & { userId: number; provider: string; model: string };

export type ResponseCache = {
  id: number;
  cacheKey: string;
  response: string;
  provider: string;
  model: string;
  expiresAt: Date;
  createdAt: Date;
};
export type InsertResponseCache = Partial<ResponseCache> & { cacheKey: string; response: string; provider: string; model: string; expiresAt: Date };

export type PromptTemplate = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  systemPrompt: string;
  userPrompt: string | null;
  provider: string | null;
  model: string | null;
  tags: string[] | null;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
};
export type InsertPromptTemplate = Partial<PromptTemplate> & { userId: number; name: string; systemPrompt: string };

export type RagDocument = {
  id: number;
  userId: number;
  name: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  sourceFile: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};
export type InsertRagDocument = Partial<RagDocument> & { userId: number; name: string; content: string; chunkIndex: number; totalChunks: number; sourceFile: string };

export type ImageGeneration = {
  id: number;
  userId: number;
  conversationId: number | null;
  prompt: string;
  provider: string;
  model: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
};
export type InsertImageGeneration = Partial<ImageGeneration> & { userId: number; prompt: string; provider: string; model: string; imageUrl: string };

export type Benchmark = {
  id: number;
  userId: number;
  prompt: string;
  results: unknown;
  createdAt: Date;
};
export type InsertBenchmark = Partial<Benchmark> & { userId: number; prompt: string; results: unknown };

// ── Supabase client ───────────────────────────────────────────────────────────
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = ENV.supabaseUrl || process.env.SUPABASE_URL || "";
    const key = ENV.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) throw new Error("Supabase URL and service role key required");
    _supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabase;
}

function toDate(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  return new Date(v as string);
}

function mapUser(r: Record<string, unknown>): User {
  return {
    id: r.id as number,
    openId: r.openId as string,
    name: r.name as string,
    email: r.email as string | null,
    loginMethod: r.loginMethod as string | null,
    role: (r.role as string) || "user",
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
    lastSignedIn: r.lastSignedIn ? toDate(r.lastSignedIn) : null,
  };
}

function mapConversation(r: Record<string, unknown>): Conversation {
  return {
    id: r.id as number,
    userId: r.userId as number,
    title: r.title as string,
    provider: r.provider as string | null,
    model: r.model as string | null,
    systemPrompt: r.systemPrompt as string | null,
    isPinned: (r.isPinned as boolean) || false,
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  };
}

function mapMessage(r: Record<string, unknown>): Message {
  return {
    id: r.id as number,
    conversationId: r.conversationId as number,
    role: r.role as string,
    content: r.content as string,
    provider: r.provider as string | null,
    model: r.model as string | null,
    promptTokens: r.promptTokens as number | null,
    completionTokens: r.completionTokens as number | null,
    totalTokens: r.totalTokens as number | null,
    cachedResponse: (r.cachedResponse as boolean) || false,
    durationMs: r.durationMs as number | null,
    imageUrls: r.imageUrls as string[] | null,
    createdAt: toDate(r.createdAt),
  };
}

function mapApiKey(r: Record<string, unknown>): ApiKey {
  return {
    id: r.id as number,
    userId: r.userId as number,
    provider: r.provider as string,
    keyName: r.keyName as string,
    encryptedKey: r.encryptedKey as string,
    baseUrl: r.baseUrl as string | null,
    isActive: (r.isActive as boolean) !== false,
    testStatus: r.testStatus as string | null,
    lastTestedAt: r.lastTestedAt ? toDate(r.lastTestedAt) : null,
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  };
}

function mapAttachment(r: Record<string, unknown>): Attachment {
  return {
    id: r.id as number,
    conversationId: r.conversationId as number,
    userId: r.userId as number,
    fileName: r.fileName as string,
    fileType: r.fileType as string,
    fileSize: r.fileSize as number,
    storageKey: r.storageKey as string,
    storageUrl: r.storageUrl as string,
    mimeType: r.mimeType as string,
    createdAt: toDate(r.createdAt),
  };
}

function mapUserPreference(r: Record<string, unknown>): UserPreference {
  return {
    id: r.id as number,
    userId: r.userId as number,
    defaultProvider: (r.defaultProvider as string) || "built-in",
    defaultModel: r.defaultModel as string | null,
    systemPrompt: r.systemPrompt as string | null,
    theme: (r.theme as string) || "system",
    streamingEnabled: r.streamingEnabled !== false,
    cacheEnabled: r.cacheEnabled !== false,
    codeSyntaxTheme: (r.codeSyntaxTheme as string) || "github",
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  };
}

function mapPromptTemplate(r: Record<string, unknown>): PromptTemplate {
  return {
    id: r.id as number,
    userId: r.userId as number,
    name: r.name as string,
    description: r.description as string | null,
    systemPrompt: r.systemPrompt as string,
    userPrompt: r.userPrompt as string | null,
    provider: r.provider as string | null,
    model: r.model as string | null,
    tags: r.tags as string[] | null,
    useCount: (r.useCount as number) || 0,
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  };
}

function mapRagDocument(r: Record<string, unknown>): RagDocument {
  return {
    id: r.id as number,
    userId: r.userId as number,
    name: r.name as string,
    content: r.content as string,
    chunkIndex: r.chunkIndex as number,
    totalChunks: r.totalChunks as number,
    sourceFile: r.sourceFile as string,
    metadata: r.metadata as Record<string, unknown> | null,
    createdAt: toDate(r.createdAt),
  };
}

function mapImageGeneration(r: Record<string, unknown>): ImageGeneration {
  return {
    id: r.id as number,
    userId: r.userId as number,
    conversationId: r.conversationId as number | null,
    prompt: r.prompt as string,
    provider: r.provider as string,
    model: r.model as string,
    imageUrl: r.imageUrl as string,
    width: r.width as number | null,
    height: r.height as number | null,
    createdAt: toDate(r.createdAt),
  };
}

function mapBenchmark(r: Record<string, unknown>): Benchmark {
  return {
    id: r.id as number,
    userId: r.userId as number,
    prompt: r.prompt as string,
    results: r.results,
    createdAt: toDate(r.createdAt),
  };
}

// ── Users ─────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId required");
  const sb = getSupabase();
  const { data: existing } = await sb.from("users").select("id").eq("openId", user.openId).limit(1);
  const now = new Date().toISOString();
  if (existing && existing.length > 0) {
    const upd: Record<string, unknown> = { updatedAt: now };
    if (user.name !== undefined) upd.name = user.name;
    if (user.email !== undefined) upd.email = user.email;
    if (user.loginMethod !== undefined) upd.loginMethod = user.loginMethod;
    if (user.lastSignedIn !== undefined) upd.lastSignedIn = user.lastSignedIn?.toISOString() || now;
    if (user.role !== undefined) upd.role = user.role;
    if (user.openId === ENV.ownerOpenId) upd.role = "admin";
    await sb.from("users").update(upd).eq("openId", user.openId);
  } else {
    await sb.from("users").insert({
      openId: user.openId,
      name: user.name || "User",
      email: user.email || null,
      loginMethod: user.loginMethod || "supabase",
      lastSignedIn: user.lastSignedIn?.toISOString() || now,
      role: user.role || (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const sb = getSupabase();
  const { data } = await sb.from("users").select("*").eq("openId", openId).limit(1);
  if (!data || data.length === 0) return undefined;
  return mapUser(data[0] as Record<string, unknown>);
}

// ── API Keys ──────────────────────────────────────────────────────────────────
export async function upsertApiKey(data: InsertApiKey): Promise<void> {
  const sb = getSupabase();
  const { data: existing } = await sb.from("api_keys")
    .select("id").eq("userId", data.userId!).eq("provider", data.provider).eq("keyName", data.keyName).limit(1);
  const now = new Date().toISOString();
  if (existing && existing.length > 0) {
    await sb.from("api_keys").update({
      encryptedKey: data.encryptedKey,
      baseUrl: data.baseUrl || null,
      isActive: data.isActive !== false,
      updatedAt: now,
    }).eq("id", (existing[0] as Record<string, unknown>).id);
  } else {
    await sb.from("api_keys").insert({
      userId: data.userId,
      provider: data.provider,
      keyName: data.keyName,
      encryptedKey: data.encryptedKey,
      baseUrl: data.baseUrl || null,
      isActive: data.isActive !== false,
      testStatus: "untested",
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function getApiKeysByUser(userId: number): Promise<ApiKey[]> {
  const sb = getSupabase();
  const { data } = await sb.from("api_keys").select("*").eq("userId", userId).order("createdAt", { ascending: false });
  return (data || []).map((r) => mapApiKey(r as Record<string, unknown>));
}

export async function deleteApiKey(id: number, userId: number): Promise<void> {
  const sb = getSupabase();
  await sb.from("api_keys").delete().eq("id", id).eq("userId", userId);
}

export async function updateApiKeyStatus(id: number, userId: number, status: "ok" | "failed" | "untested"): Promise<void> {
  const sb = getSupabase();
  await sb.from("api_keys").update({ testStatus: status, lastTestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .eq("id", id).eq("userId", userId);
}

export async function getApiKeyById(id: number, userId: number): Promise<ApiKey | undefined> {
  const sb = getSupabase();
  const { data } = await sb.from("api_keys").select("*").eq("id", id).eq("userId", userId).limit(1);
  if (!data || data.length === 0) return undefined;
  return mapApiKey(data[0] as Record<string, unknown>);
}

export async function updateApiKeyTestStatus(id: number, status: "ok" | "failed" | "untested"): Promise<void> {
  const sb = getSupabase();
  await sb.from("api_keys").update({ testStatus: status, lastTestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq("id", id);
}

// ── Conversations ─────────────────────────────────────────────────────────────
export async function createConversation(data: InsertConversation): Promise<number> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const { data: r, error } = await sb.from("conversations").insert({
    userId: data.userId,
    title: data.title,
    provider: data.provider || null,
    model: data.model || null,
    systemPrompt: data.systemPrompt || null,
    isPinned: false,
    createdAt: now,
    updatedAt: now,
  }).select("id");
  if (error) throw new Error(error.message);
  return (r![0] as Record<string, unknown>).id as number;
}

export async function getConversationsByUser(userId: number): Promise<Conversation[]> {
  const sb = getSupabase();
  const { data } = await sb.from("conversations").select("*").eq("userId", userId).order("updatedAt", { ascending: false });
  return (data || []).map((r) => mapConversation(r as Record<string, unknown>));
}

export async function getConversationById(id: number, userId: number): Promise<Conversation | undefined> {
  const sb = getSupabase();
  const { data } = await sb.from("conversations").select("*").eq("id", id).eq("userId", userId).limit(1);
  if (!data || data.length === 0) return undefined;
  return mapConversation(data[0] as Record<string, unknown>);
}

export async function updateConversationTitle(id: number, userId: number, title: string): Promise<void> {
  const sb = getSupabase();
  await sb.from("conversations").update({ title, updatedAt: new Date().toISOString() }).eq("id", id).eq("userId", userId);
}

export async function updateConversation(id: number, userId: number, data: Partial<InsertConversation>): Promise<void> {
  const sb = getSupabase();
  const upd: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.title !== undefined) upd.title = data.title;
  if (data.provider !== undefined) upd.provider = data.provider;
  if (data.model !== undefined) upd.model = data.model;
  if (data.systemPrompt !== undefined) upd.systemPrompt = data.systemPrompt;
  await sb.from("conversations").update(upd).eq("id", id).eq("userId", userId);
}

export async function deleteConversation(id: number, userId: number): Promise<void> {
  const sb = getSupabase();
  await sb.from("messages").delete().eq("conversationId", id);
  await sb.from("conversations").delete().eq("id", id).eq("userId", userId);
}

export async function toggleConversationPin(id: number, userId: number, isPinned: boolean): Promise<void> {
  const sb = getSupabase();
  await sb.from("conversations").update({ isPinned, updatedAt: new Date().toISOString() }).eq("id", id).eq("userId", userId);
}

// ── Messages ──────────────────────────────────────────────────────────────────
export async function createMessage(data: InsertMessage): Promise<number> {
  const sb = getSupabase();
  const { data: r, error } = await sb.from("messages").insert({
    conversationId: data.conversationId,
    role: data.role,
    content: data.content,
    provider: data.provider || null,
    model: data.model || null,
    promptTokens: data.promptTokens || null,
    completionTokens: data.completionTokens || null,
    totalTokens: data.totalTokens || null,
    cachedResponse: data.cachedResponse || false,
    durationMs: data.durationMs || null,
    imageUrls: data.imageUrls || null,
    createdAt: new Date().toISOString(),
  }).select("id");
  if (error) throw new Error(error.message);
  return (r![0] as Record<string, unknown>).id as number;
}

export async function getMessagesByConversation(conversationId: number): Promise<Message[]> {
  const sb = getSupabase();
  const { data } = await sb.from("messages").select("*").eq("conversationId", conversationId).order("createdAt", { ascending: true });
  return (data || []).map((r) => mapMessage(r as Record<string, unknown>));
}

// ── Attachments ───────────────────────────────────────────────────────────────
export async function createAttachment(data: InsertAttachment): Promise<number> {
  const sb = getSupabase();
  const { data: r, error } = await sb.from("attachments").insert({
    conversationId: data.conversationId,
    userId: data.userId,
    fileName: data.fileName,
    fileType: data.fileType,
    fileSize: data.fileSize,
    storageKey: data.storageKey,
    storageUrl: data.storageUrl,
    mimeType: data.mimeType,
    createdAt: new Date().toISOString(),
  }).select("id");
  if (error) throw new Error(error.message);
  return (r![0] as Record<string, unknown>).id as number;
}

export async function getAttachmentsByConversation(conversationId: number): Promise<Attachment[]> {
  const sb = getSupabase();
  const { data } = await sb.from("attachments").select("*").eq("conversationId", conversationId).order("createdAt", { ascending: true });
  return (data || []).map((r) => mapAttachment(r as Record<string, unknown>));
}

// ── User Preferences ──────────────────────────────────────────────────────────
export async function getUserPreferences(userId: number): Promise<UserPreference | undefined> {
  const sb = getSupabase();
  const { data } = await sb.from("user_preferences").select("*").eq("userId", userId).limit(1);
  if (!data || data.length === 0) return undefined;
  return mapUserPreference(data[0] as Record<string, unknown>);
}

export async function upsertUserPreferences(data: InsertUserPreference): Promise<void> {
  const sb = getSupabase();
  const { data: existing } = await sb.from("user_preferences").select("id").eq("userId", data.userId).limit(1);
  const now = new Date().toISOString();
  if (existing && existing.length > 0) {
    await sb.from("user_preferences").update({
      defaultProvider: data.defaultProvider || "built-in",
      defaultModel: data.defaultModel || null,
      systemPrompt: data.systemPrompt || null,
      theme: data.theme || "system",
      streamingEnabled: data.streamingEnabled !== false,
      cacheEnabled: data.cacheEnabled !== false,
      codeSyntaxTheme: data.codeSyntaxTheme || "github",
      updatedAt: now,
    }).eq("userId", data.userId);
  } else {
    await sb.from("user_preferences").insert({
      userId: data.userId,
      defaultProvider: data.defaultProvider || "built-in",
      defaultModel: data.defaultModel || null,
      systemPrompt: data.systemPrompt || null,
      theme: data.theme || "system",
      streamingEnabled: data.streamingEnabled !== false,
      cacheEnabled: data.cacheEnabled !== false,
      codeSyntaxTheme: data.codeSyntaxTheme || "github",
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ── Usage Logs ────────────────────────────────────────────────────────────────
export async function createUsageLog(data: InsertUsageLog): Promise<void> {
  const sb = getSupabase();
  await sb.from("usage_logs").insert({
    userId: data.userId,
    provider: data.provider,
    model: data.model,
    promptTokens: data.promptTokens || 0,
    completionTokens: data.completionTokens || 0,
    totalTokens: data.totalTokens || 0,
    estimatedCostUsd: data.estimatedCostUsd || 0,
    requestType: data.requestType || "chat",
    success: data.success !== false,
    errorMessage: data.errorMessage || null,
    durationMs: data.durationMs || 0,
    createdAt: new Date().toISOString(),
  });
}

export async function getUsageLogsByUser(userId: number, limit = 100) {
  const sb = getSupabase();
  const { data } = await sb.from("usage_logs").select("*").eq("userId", userId).order("createdAt", { ascending: false }).limit(limit);
  return data || [];
}

export async function getUsageStats(userId: number) {
  const sb = getSupabase();
  const { data } = await sb.from("usage_logs").select("totalTokens, success").eq("userId", userId);
  const logs = data || [];
  const totalTokens = logs.reduce((s: number, l: Record<string, unknown>) => s + ((l.totalTokens as number) || 0), 0);
  const totalRequests = logs.length;
  const successRate = totalRequests > 0 ? logs.filter((l: Record<string, unknown>) => l.success).length / totalRequests : 1;
  return { totalTokens, totalRequests, successRate };
}

export async function getUsageSummary(userId: number, days: number = 30) {
  const sb = getSupabase();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb.from("usage_logs").select("totalTokens, success, estimatedCostUsd").eq("userId", userId).gte("createdAt", since);
  const logs = data || [];
  const totalTokens = logs.reduce((s: number, l: Record<string, unknown>) => s + ((l.totalTokens as number) || 0), 0);
  const totalRequests = logs.length;
  const successRate = totalRequests > 0 ? logs.filter((l: Record<string, unknown>) => l.success).length / totalRequests : 1;
  const totalCost = logs.reduce((s: number, l: Record<string, unknown>) => s + ((l.estimatedCostUsd as number) || 0), 0);
  return { totalTokens, totalRequests, successRate, totalCost };
}

export async function getDailyUsage(userId: number, days: number = 14) {
  const sb = getSupabase();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb.from("usage_logs").select("totalTokens, createdAt, estimatedCostUsd").eq("userId", userId).gte("createdAt", since).order("createdAt", { ascending: true });
  const byDate: Record<string, { date: string; tokens: number; requests: number; cost: number }> = {};
  for (const log of (data || [])) {
    const r = log as Record<string, unknown>;
    const date = (r.createdAt as string).split("T")[0];
    if (!byDate[date]) byDate[date] = { date, tokens: 0, requests: 0, cost: 0 };
    byDate[date].tokens += (r.totalTokens as number) || 0;
    byDate[date].requests += 1;
    byDate[date].cost += (r.estimatedCostUsd as number) || 0;
  }
  return Object.values(byDate);
}

// ── Response Cache ────────────────────────────────────────────────────────────
export async function getCachedResponse(cacheKey: string): Promise<ResponseCache | undefined> {
  const sb = getSupabase();
  const { data } = await sb.from("response_cache").select("*").eq("cacheKey", cacheKey).gt("expiresAt", new Date().toISOString()).limit(1);
  if (!data || data.length === 0) return undefined;
  const r = data[0] as Record<string, unknown>;
  return {
    id: r.id as number,
    cacheKey: r.cacheKey as string,
    response: r.response as string,
    provider: r.provider as string,
    model: r.model as string,
    expiresAt: toDate(r.expiresAt),
    createdAt: toDate(r.createdAt),
  };
}

export async function setCachedResponse(data: InsertResponseCache): Promise<void> {
  const sb = getSupabase();
  const { data: existing } = await sb.from("response_cache").select("id").eq("cacheKey", data.cacheKey).limit(1);
  if (existing && existing.length > 0) {
    await sb.from("response_cache").update({
      response: data.response,
      expiresAt: data.expiresAt.toISOString(),
    }).eq("cacheKey", data.cacheKey);
  } else {
    await sb.from("response_cache").insert({
      cacheKey: data.cacheKey,
      response: data.response,
      provider: data.provider,
      model: data.model,
      expiresAt: data.expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    });
  }
}

// ── Prompt Templates ──────────────────────────────────────────────────────────
export async function getPromptTemplatesByUser(userId: number): Promise<PromptTemplate[]> {
  const sb = getSupabase();
  const { data } = await sb.from("prompt_templates").select("*").eq("userId", userId).order("createdAt", { ascending: false });
  return (data || []).map((r) => mapPromptTemplate(r as Record<string, unknown>));
}

export async function createPromptTemplate(data: InsertPromptTemplate): Promise<number> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const { data: r, error } = await sb.from("prompt_templates").insert({
    userId: data.userId,
    name: data.name,
    description: data.description || null,
    systemPrompt: data.systemPrompt,
    userPrompt: data.userPrompt || null,
    provider: data.provider || null,
    model: data.model || null,
    tags: data.tags || null,
    useCount: 0,
    createdAt: now,
    updatedAt: now,
  }).select("id");
  if (error) throw new Error(error.message);
  return (r![0] as Record<string, unknown>).id as number;
}

export async function updatePromptTemplate(id: number, userId: number, data: Partial<PromptTemplate>): Promise<void> {
  const sb = getSupabase();
  const upd: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.name !== undefined) upd.name = data.name;
  if (data.description !== undefined) upd.description = data.description;
  if (data.systemPrompt !== undefined) upd.systemPrompt = data.systemPrompt;
  if (data.userPrompt !== undefined) upd.userPrompt = data.userPrompt;
  if (data.provider !== undefined) upd.provider = data.provider;
  if (data.model !== undefined) upd.model = data.model;
  if (data.tags !== undefined) upd.tags = data.tags;
  await sb.from("prompt_templates").update(upd).eq("id", id).eq("userId", userId);
}

export async function deletePromptTemplate(id: number, userId: number): Promise<void> {
  const sb = getSupabase();
  await sb.from("prompt_templates").delete().eq("id", id).eq("userId", userId);
}

export async function getPromptTemplateById(id: number, userId: number): Promise<PromptTemplate | undefined> {
  const sb = getSupabase();
  const { data } = await sb.from("prompt_templates").select("*").eq("id", id).eq("userId", userId).limit(1);
  if (!data || data.length === 0) return undefined;
  return mapPromptTemplate(data[0] as Record<string, unknown>);
}

export async function incrementTemplateUseCount(id: number): Promise<void> {
  const sb = getSupabase();
  const { data } = await sb.from("prompt_templates").select("useCount").eq("id", id).limit(1);
  if (data && data.length > 0) {
    const r = data[0] as Record<string, unknown>;
    await sb.from("prompt_templates").update({ useCount: ((r.useCount as number) || 0) + 1 }).eq("id", id);
  }
}

// ── RAG Documents ─────────────────────────────────────────────────────────────
export async function createRagDocument(data: InsertRagDocument): Promise<number> {
  const sb = getSupabase();
  const { data: r, error } = await sb.from("rag_documents").insert({
    userId: data.userId,
    name: data.name,
    content: data.content,
    chunkIndex: data.chunkIndex,
    totalChunks: data.totalChunks,
    sourceFile: data.sourceFile,
    metadata: data.metadata || null,
    createdAt: new Date().toISOString(),
  }).select("id");
  if (error) throw new Error(error.message);
  return (r![0] as Record<string, unknown>).id as number;
}

export async function getRagDocumentsByUser(userId: number): Promise<RagDocument[]> {
  const sb = getSupabase();
  const { data } = await sb.from("rag_documents").select("*").eq("userId", userId).eq("chunkIndex", 0).order("createdAt", { ascending: false });
  return (data || []).map((r) => mapRagDocument(r as Record<string, unknown>));
}

export async function getRagChunksByFile(userId: number, sourceFile: string): Promise<RagDocument[]> {
  const sb = getSupabase();
  const { data } = await sb.from("rag_documents").select("*").eq("userId", userId).eq("sourceFile", sourceFile).order("chunkIndex", { ascending: true });
  return (data || []).map((r) => mapRagDocument(r as Record<string, unknown>));
}

export async function getAllRagChunks(userId: number): Promise<RagDocument[]> {
  const sb = getSupabase();
  const { data } = await sb.from("rag_documents").select("*").eq("userId", userId).order("createdAt", { ascending: true });
  return (data || []).map((r) => mapRagDocument(r as Record<string, unknown>));
}

export async function deleteRagDocument(userId: number, sourceFile: string): Promise<void> {
  const sb = getSupabase();
  await sb.from("rag_documents").delete().eq("userId", userId).eq("sourceFile", sourceFile);
}

// ── Image Generations ─────────────────────────────────────────────────────────
export async function createImageGeneration(data: InsertImageGeneration): Promise<number> {
  const sb = getSupabase();
  const { data: r, error } = await sb.from("image_generations").insert({
    userId: data.userId,
    conversationId: data.conversationId || null,
    prompt: data.prompt,
    provider: data.provider,
    model: data.model,
    imageUrl: data.imageUrl,
    width: data.width || null,
    height: data.height || null,
    createdAt: new Date().toISOString(),
  }).select("id");
  if (error) throw new Error(error.message);
  return (r![0] as Record<string, unknown>).id as number;
}

export async function getImageGenerationsByUser(userId: number, limit = 50): Promise<ImageGeneration[]> {
  const sb = getSupabase();
  const { data } = await sb.from("image_generations").select("*").eq("userId", userId).order("createdAt", { ascending: false }).limit(limit);
  return (data || []).map((r) => mapImageGeneration(r as Record<string, unknown>));
}

// ── Benchmarks ────────────────────────────────────────────────────────────────
export async function createBenchmark(data: InsertBenchmark): Promise<number> {
  const sb = getSupabase();
  const { data: r, error } = await sb.from("benchmarks").insert({
    userId: data.userId,
    prompt: data.prompt,
    results: data.results,
    createdAt: new Date().toISOString(),
  }).select("id");
  if (error) throw new Error(error.message);
  return (r![0] as Record<string, unknown>).id as number;
}

export async function getBenchmarksByUser(userId: number, limit = 20): Promise<Benchmark[]> {
  const sb = getSupabase();
  const { data } = await sb.from("benchmarks").select("*").eq("userId", userId).order("createdAt", { ascending: false }).limit(limit);
  return (data || []).map((r) => mapBenchmark(r as Record<string, unknown>));
}
