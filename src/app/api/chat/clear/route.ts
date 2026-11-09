import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    let body: { conversationId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    if (typeof body.conversationId !== "string" || !body.conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }
    await db.delete(messages).where(eq(messages.conversationId, body.conversationId));
    return NextResponse.json({ message: "Cleared" });
  } catch (e:any){
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
