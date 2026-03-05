import { relations } from "drizzle-orm";
import { users, conversations, messages, attachments, apiKeys, userPreferences, usageLogs, promptTemplates, ragDocuments, imageGenerations, benchmarks } from "./schema";

export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations),
  apiKeys: many(apiKeys),
  usageLogs: many(usageLogs),
  preferences: one(userPreferences, { fields: [users.id], references: [userPreferences.userId] }),
  promptTemplates: many(promptTemplates),
  ragDocuments: many(ragDocuments),
  imageGenerations: many(imageGenerations),
  benchmarks: many(benchmarks),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
  attachments: many(attachments),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  conversation: one(conversations, { fields: [attachments.conversationId], references: [conversations.id] }),
  message: one(messages, { fields: [attachments.messageId], references: [messages.id] }),
}));
