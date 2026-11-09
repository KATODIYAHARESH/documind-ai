import { pgTable, text, timestamp, integer, uuid, varchar, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const documentStatusEnum = pgEnum("document_status", ["uploading", "processing", "completed", "failed"]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  size: integer("size").notNull(),
  status: documentStatusEnum("status").notNull().default("processing"),
  pageCount: integer("page_count"),
  chunkCount: integer("chunk_count").default(0),
  textLength: integer("text_length").default(0),
  preview: text("preview"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  pageNumber: integer("page_number"),
  heading: text("heading"),
  tokenCount: integer("token_count"),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).default("New Conversation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).notNull(), // user | assistant
  content: text("content").notNull(),
  sources: text("sources"), // JSON string of chunk references
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(chunks),
  conversations: many(conversations),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, { fields: [chunks.documentId], references: [documents.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  document: one(documents, { fields: [conversations.documentId], references: [documents.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export type Document = typeof documents.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
