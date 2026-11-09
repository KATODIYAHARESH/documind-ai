import { describe, expect, it } from "vitest";
import { asc, desc, eq } from "drizzle-orm";
import { createInMemoryDb } from "@/db";
import { chunks, conversations, documents, messages } from "@/db/schema";

describe("in-memory database", () => {
  it("supports filters, ordering, updates, and document cascades", async () => {
    const memoryDb = createInMemoryDb();
    const [older, newer] = await memoryDb.insert(documents).values([
      {
        filename: "older.txt",
        originalName: "older.txt",
        mimeType: "text/plain",
        size: 20,
        status: "processing",
        chunkCount: 0,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
      },
      {
        filename: "newer.txt",
        originalName: "newer.txt",
        mimeType: "text/plain",
        size: 20,
        status: "processing",
        chunkCount: 0,
        createdAt: new Date("2025-01-02T00:00:00.000Z"),
      },
    ]).returning();

    await memoryDb.insert(chunks).values({
      documentId: newer.id,
      chunkIndex: 0,
      content: "A sufficiently long test passage for the document.",
      pageNumber: 1,
      tokenCount: 12,
    });
    const [conversation] = await memoryDb.insert(conversations).values({
      documentId: newer.id,
      title: "Test conversation",
    }).returning();
    const [remainingConversation] = await memoryDb.insert(conversations).values({
      documentId: newer.id,
      title: "Conversation to cascade",
    }).returning();
    await memoryDb.insert(messages).values({
      conversationId: conversation.id,
      role: "user",
      content: "Test question",
    });
    await memoryDb.insert(messages).values({
      conversationId: remainingConversation.id,
      role: "user",
      content: "Cascade question",
    });

    await memoryDb.update(documents).set({ status: "completed", chunkCount: 1 }).where(eq(documents.id, newer.id));

    const matching = await memoryDb.select().from(documents).where(eq(documents.id, newer.id));
    const ordered = await memoryDb.select().from(documents).orderBy(desc(documents.createdAt));
    const allChunks = await memoryDb.select().from(chunks);
    const chunksAscending = await memoryDb.select().from(chunks).where(eq(chunks.documentId, newer.id)).orderBy(asc(chunks.chunkIndex));

    expect(matching).toHaveLength(1);
    expect(matching[0]).toMatchObject({ status: "completed", chunkCount: 1 });
    expect(ordered.map((doc: { id: string }) => doc.id)).toEqual([newer.id, older.id]);
    expect(allChunks).toHaveLength(1);
    expect(chunksAscending).toHaveLength(1);

    await memoryDb.delete(conversations).where(eq(conversations.id, conversation.id));
    expect(await memoryDb.select().from(messages).where(eq(messages.conversationId, conversation.id))).toHaveLength(0);

    await memoryDb.delete(documents).where(eq(documents.id, newer.id)).returning();
    expect(await memoryDb.select().from(chunks).where(eq(chunks.documentId, newer.id))).toHaveLength(0);
    expect(await memoryDb.select().from(conversations).where(eq(conversations.documentId, newer.id))).toHaveLength(0);
    expect(await memoryDb.select().from(messages).where(eq(messages.conversationId, remainingConversation.id))).toHaveLength(0);
    await memoryDb.delete(documents).where(eq(documents.id, older.id)).returning();
  });
});
