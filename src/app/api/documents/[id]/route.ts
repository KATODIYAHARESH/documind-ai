import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, chunks } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const doc = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc[0]) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    
    const docChunks = await db.select().from(chunks).where(eq(chunks.documentId, id)).orderBy(chunks.chunkIndex);
    
    return NextResponse.json({ document: doc[0], chunks: docChunks });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deleted = await db.delete(documents).where(eq(documents.id, id)).returning();
    if (deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ message: "Deleted", id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
