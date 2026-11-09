import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, documents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET conversations for a document ?documentId=xxx
export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get("documentId");
  try {
    if (docId) {
      const convs = await db.select().from(conversations).where(eq(conversations.documentId, docId)).orderBy(desc(conversations.updatedAt));
      return NextResponse.json({ conversations: convs });
    } else {
      const all = await db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(50);
      return NextResponse.json({ conversations: all });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: { documentId?: unknown; title?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    if (typeof body.documentId !== "string" || !body.documentId) {
      return NextResponse.json({ error: "documentId required" }, { status: 400 });
    }
    const doc = await db.select().from(documents).where(eq(documents.id, body.documentId)).limit(1);
    if (!doc[0]) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 255) : "";
    const [conv] = await db.insert(conversations).values({ documentId: body.documentId, title: title || "New Conversation" }).returning();
    return NextResponse.json({ conversation: conv });
  } catch (error) {
    console.error("Create conversation failed:", error);
    return NextResponse.json({ error: "Could not create conversation." }, { status: 500 });
  }
}
