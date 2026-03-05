import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  ApiKey,
  Attachment,
  Conversation,
  InsertApiKey,
  InsertAttachment,
  InsertConversation,
  InsertMessage,
  InsertResponseCache,
  InsertUsageLog,
  InsertUserPreference,
  Message,
  UserPreference,
  apiKeys,
  attachments,
  conversations,
  messages,
  responseCache,
  usageLogs,
  userPreferences,
  users,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ── API Keys ──────────────────────────────────────────────────────────────────
export async function upsertApiKey(data: InsertApiKey): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(apiKeys).values(data).onDuplicateKeyUpdate({
    set: {
      encryptedKey: data.encryptedKey,
      keyName: data.keyName,
      baseUrl: data.baseUrl,
      isActive: data.isActive,
      updatedAt: new Date(),
    },
  });
}

export async function getApiKeysByUser(userId: number): Promise<ApiKey[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(apiKeys.provider);
}

export async function getApiKeyById(id: number, userId: number): Promise<ApiKey | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .limit(1);
  return result[0];
}

export async function deleteApiKey(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
}

export async function updateApiKeyTestStatus(
  id: number,
  status: "ok" | "failed",
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(apiKeys)
    .set({ testStatus: status, lastTestedAt: new Date() })
    .where(eq(apiKeys.id, id));
}

// ── Conversations ─────────────────────────────────────────────────────────────
export async function createConversation(data: InsertConversation): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(conversations).values(data);
  return (result as unknown as { insertId: number }).insertId;
}

export async function getConversationsByUser(
  userId: number,
  limit = 50,
): Promise<Conversation[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

export async function getConversationById(
  id: number,
  userId: number,
): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateConversationTitle(
  id: number,
  userId: number,
  title: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function toggleConversationPin(
  id: number,
  userId: number,
  isPinned: boolean,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(conversations)
    .set({ isPinned })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function deleteConversation(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(messages)
    .where(eq(messages.conversationId, id));
  await db
    .delete(attachments)
    .where(eq(attachments.conversationId, id));
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

// ── Messages ──────────────────────────────────────────────────────────────────
export async function createMessage(data: InsertMessage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(messages).values(data);
  return (result as unknown as { insertId: number }).insertId;
}

export async function getMessagesByConversation(conversationId: number): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

// ── Attachments ───────────────────────────────────────────────────────────────
export async function createAttachment(data: InsertAttachment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(attachments).values(data);
  return (result as unknown as { insertId: number }).insertId;
}

export async function getAttachmentsByConversation(conversationId: number): Promise<Attachment[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(attachments)
    .where(eq(attachments.conversationId, conversationId))
    .orderBy(attachments.createdAt);
}

// ── User Preferences ──────────────────────────────────────────────────────────
export async function getUserPreferences(userId: number): Promise<UserPreference | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return result[0];
}

export async function upsertUserPreferences(data: InsertUserPreference): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(userPreferences).values(data).onDuplicateKeyUpdate({
    set: {
      defaultProvider: data.defaultProvider,
      defaultModel: data.defaultModel,
      systemPrompt: data.systemPrompt,
      theme: data.theme,
      streamingEnabled: data.streamingEnabled,
      cacheEnabled: data.cacheEnabled,
      codeSyntaxTheme: data.codeSyntaxTheme,
      updatedAt: new Date(),
    },
  });
}

// ── Usage Logs ────────────────────────────────────────────────────────────────
export async function createUsageLog(data: InsertUsageLog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(usageLogs).values(data);
}

export async function getUsageSummary(userId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select({
      provider: usageLogs.provider,
      model: usageLogs.model,
      totalRequests: sql<number>`cast(count(*) as unsigned)`,
      totalTokens: sql<number>`cast(coalesce(sum(${usageLogs.totalTokens}), 0) as unsigned)`,
      totalCost: sql<number>`coalesce(sum(${usageLogs.estimatedCostUsd}), 0)`,
      successRate: sql<number>`avg(case when ${usageLogs.success} = 1 then 100 else 0 end)`,
    })
    .from(usageLogs)
    .where(and(eq(usageLogs.userId, userId), gte(usageLogs.createdAt, since)))
    .groupBy(usageLogs.provider, usageLogs.model)
    .orderBy(desc(sql`count(*)`));
}

export async function getDailyUsage(userId: number, days = 14) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dateExpr = sql<string>`DATE(${usageLogs.createdAt})`;
  return db
    .select({
      date: dateExpr,
      totalRequests: sql<number>`cast(count(*) as unsigned)`,
      totalTokens: sql<number>`cast(coalesce(sum(${usageLogs.totalTokens}), 0) as unsigned)`,
    })
    .from(usageLogs)
    .where(and(eq(usageLogs.userId, userId), gte(usageLogs.createdAt, since)))
    .groupBy(dateExpr)
    .orderBy(dateExpr);
}

// ── Response Cache ────────────────────────────────────────────────────────────
export async function getCachedResponse(cacheKey: string): Promise<import('../drizzle/schema').ResponseCache | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const now = new Date();
    const result = await db
      .select()
      .from(responseCache)
      .where(and(eq(responseCache.cacheKey, cacheKey), gte(responseCache.expiresAt, now)))
      .limit(1);
    if (result[0]) {
      await db
        .update(responseCache)
        .set({ hitCount: sql`${responseCache.hitCount} + 1` })
        .where(eq(responseCache.cacheKey, cacheKey));
    }
    return result[0];
  } catch (error) {
    console.warn("[Cache] Failed to get cached response:", error);
    return undefined;
  }
}

export async function setCachedResponse(data: InsertResponseCache): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(responseCache)
      .values(data)
      .onDuplicateKeyUpdate({
        set: {
          response: data.response,
          hitCount: 0,
          expiresAt: data.expiresAt,
        },
      });
  } catch (error) {
    console.warn("[Cache] Failed to set cached response:", error);
  }
}

export async function cleanExpiredCache(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(responseCache).where(lt(responseCache.expiresAt, new Date()));
  } catch (error) {
    console.warn("[Cache] Failed to clean expired cache:", error);
  }
}

export type { ResponseCache } from "../drizzle/schema";
