import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const conv = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!conv[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    return NextResponse.json({ conversation: conv[0], messages: msgs });
  } catch (e:any){
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
    return NextResponse.json({ message: "Deleted" });
  } catch (e:any){
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
