import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/documents/[id]/ask/route";
import { db } from "@/db";
import { chunks, documents, messages } from "@/db/schema";
import { eq } from "drizzle-orm";

const createdDocumentIds: string[] = [];

afterEach(async () => {
  for (const id of createdDocumentIds.splice(0)) {
    await db.delete(documents).where(eq(documents.id, id));
  }
});

describe("multi-document grounded answers", () => {
  it("streams exact passages and page-specific citations from every selected contract", async () => {
    const [contractA, contractB] = await db.insert(documents).values([
      {
        filename: "contract-alpha.txt",
        originalName: "contract-alpha.txt",
        mimeType: "text/plain",
        size: 100,
        status: "completed",
        chunkCount: 1,
        pageCount: 1,
      },
      {
        filename: "contract-beta.txt",
        originalName: "contract-beta.txt",
        mimeType: "text/plain",
        size: 100,
        status: "completed",
        chunkCount: 1,
        pageCount: 1,
      },
    ]).returning();
    createdDocumentIds.push(contractA.id, contractB.id);

    await db.insert(chunks).values([
      {
        documentId: contractA.id,
        chunkIndex: 0,
        content: "Contract Alpha payment terms: payment is due within 30 days after invoice.",
        pageNumber: 2,
        heading: "Payment",
        tokenCount: 13,
      },
      {
        documentId: contractB.id,
        chunkIndex: 0,
        content: "Contract Beta payment terms: payment is due within 45 days after invoice.",
        pageNumber: 5,
        heading: "Payment",
        tokenCount: 13,
      },
    ]);

    const request = new NextRequest("http://localhost/api/documents/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Compare payment terms across these contracts.",
        documentIds: [contractA.id, contractB.id],
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: contractA.id }) });
    const events = (await response.text())
      .split("\n\n")
      .filter((event) => event.startsWith("data: "))
      .map((event) => JSON.parse(event.slice(6)) as { type: string; sources?: Array<Record<string, unknown>> });
    const meta = events.find((event) => event.type === "meta");

    expect(response.status).toBe(200);
    expect(meta?.sources).toHaveLength(2);
    expect(meta?.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentName: "contract-alpha.txt", pageNumber: 2, passage: expect.stringContaining("30 days"), evidenceStatus: "partial" }),
      expect.objectContaining({ documentName: "contract-beta.txt", pageNumber: 5, passage: expect.stringContaining("45 days"), evidenceStatus: "partial" }),
    ]));
    const assistantMessages = await db.select().from(messages) as Array<{ sources: string | null }>;
    expect(assistantMessages.some((message) => message.sources?.includes("contract-alpha.txt") && message.sources.includes("contract-beta.txt"))).toBe(true);
  }, 20000);
});
