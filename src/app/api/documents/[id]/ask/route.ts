import { NextRequest } from "next/server";
import { db } from "@/db";
import { documents, chunks, conversations, messages } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { assessEvidence, retrieveChunks, buildContext, formatSources } from "@/lib/retrieval";
import { streamGemini, SYSTEM_PROMPT } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { question?: unknown; conversationId?: unknown; documentIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Request body must be valid JSON." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Request body must be a JSON object." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const question = typeof body.question === "string" ? body.question.trim() : "";
    const incomingConvId = body.conversationId;
    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (question.length > 2000) {
      return new Response(JSON.stringify({ error: "Question too long. Please shorten it." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (incomingConvId !== undefined && incomingConvId !== null && typeof incomingConvId !== "string") {
      return new Response(JSON.stringify({ error: "conversationId must be a string." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (body.documentIds !== undefined && (!Array.isArray(body.documentIds) || body.documentIds.length === 0 || body.documentIds.length > 5 || body.documentIds.some((docId) => typeof docId !== "string"))) {
      return new Response(JSON.stringify({ error: "documentIds must contain between 1 and 5 document IDs." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const documentIds = Array.from(new Set([id, ...((body.documentIds as string[] | undefined) ?? [])]));
    if (documentIds.length > 5) {
      return new Response(JSON.stringify({ error: "You can ask about up to 5 documents at once." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    
    // Verify document exists
    const selectedDocs = (await Promise.all(documentIds.map(async (documentId) => {
      const [document] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
      return document;
    }))).filter((document) => document !== undefined);
    if (selectedDocs.length !== documentIds.length) {
      return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (selectedDocs.some((doc) => doc.status !== "completed")) {
      return new Response(JSON.stringify({ error: "Document is still processing. Please wait." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    
    const documentNames = new Map(selectedDocs.map((doc) => [doc.id, doc.filename]));
    const docChunks = (await Promise.all(documentIds.map((documentId) =>
      db.select().from(chunks).where(eq(chunks.documentId, documentId)).orderBy(asc(chunks.chunkIndex)),
    ))).flat();
    if (docChunks.length === 0) {
      return new Response(JSON.stringify({ error: "No content available for this document" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    
    // Retrieval
    const retrieved = retrieveChunks(question, docChunks, 5).map((chunk) => ({
      ...chunk,
      documentName: documentNames.get(chunk.documentId) ?? "Document",
    }));
    const context = buildContext(retrieved);
    const sourcesJson = formatSources(retrieved, question);
    const evidence = retrieved.map((chunk) => assessEvidence(question, chunk.content));
    const evidenceStatus = evidence.some((item) => item.status === "strong")
      ? "strong"
      : evidence.some((item) => item.status === "partial") ? "partial" : "limited";
    
    // Handle conversation
    let conversationId: string;
    let historyMessages: { role: string, content: string }[] = [];
    
    if (typeof incomingConvId !== "string") {
      const [conv] = await db.insert(conversations).values({
        documentId: id,
        title: question.slice(0, 80),
      }).returning();
      conversationId = conv.id;
    } else {
      conversationId = incomingConvId;
      // verify ownership and fetch history
      const convCheck = await db.select().from(conversations).where(eq(conversations.id, incomingConvId)).limit(1);
      if (!convCheck[0] || convCheck[0].documentId !== id) {
        // create new if mismatch
        const [conv] = await db.insert(conversations).values({ documentId: id, title: question.slice(0,80) }).returning();
        conversationId = conv.id;
      } else {
        const history = await db.select().from(messages).where(eq(messages.conversationId, incomingConvId)).orderBy(desc(messages.createdAt)).limit(10);
        historyMessages = (history as Array<{ role: string; content: string }>).reverse().map((m) => ({ role: m.role, content: m.content }));
      }
    }
    
    // Save user message
    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: question,
    });
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
    
    // Prepare streaming
    const historyForAI = historyMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullAnswer = "";
        
        // Send metadata first
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", conversationId, evidenceStatus, sources: JSON.parse(sourcesJson) })}\n\n`));
        
        try {
          const generator = streamGemini(SYSTEM_PROMPT, context, question, historyForAI);
          
          for await (const chunk of generator) {
            if (chunk.error) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: chunk.error })}\n\n`));
              break;
            }
            if (chunk.text) {
              fullAnswer += chunk.text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunk.text })}\n\n`));
            }
            if (chunk.done) break;
          }
          
          // Save assistant message
          if (fullAnswer.trim()) {
            await db.insert(messages).values({
              conversationId,
              role: "assistant",
              content: fullAnswer,
              sources: sourcesJson,
            });
            await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", conversationId })}\n\n`));
          controller.close();
        } catch (e: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: e.message || "Generation failed" })}\n\n`));
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Conversation-Id": conversationId,
      }
    });
    
  } catch (e: any) {
    console.error("Ask error", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
