import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, chunks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateSummary, SummaryType } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
const summaryTypes: SummaryType[] = ["short", "detailed", "keypoints", "definitions", "findings", "conclusions", "action", "flashcards"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    let body: { type?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    const type = body.type ?? "short";
    if (typeof type !== "string" || !summaryTypes.includes(type as (typeof summaryTypes)[number])) {
      return NextResponse.json({ error: "Unsupported summary type." }, { status: 400 });
    }
    
    const doc = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc[0]) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc[0].status !== "completed") return NextResponse.json({ error: "Document not ready" }, { status: 400 });
    
    const docChunks = await db.select().from(chunks).where(eq(chunks.documentId, id)).orderBy(chunks.chunkIndex);
    if (docChunks.length === 0) return NextResponse.json({ error: "No content" }, { status: 400 });
    
    // For large docs, use hierarchical: build context from all chunks truncated + important ones
    let context = (docChunks as Array<{ content: string }>).map((c, i) => `[Section ${i + 1}]\n${c.content}`).join("\n\n");
    // Limit to ~12000 chars for prompt
    if (context.length > 12000) {
      // Take first 4000 + last 4000 + middle retrieval
      context = context.slice(0, 5000) + "\n\n[... middle sections truncated ...]\n\n" + context.slice(-5000);
    }
    
    const summary = await generateSummary(context, type as SummaryType);
    
    return NextResponse.json({ summary, type, documentId: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
