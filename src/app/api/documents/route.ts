import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const docs = await db.select().from(documents).orderBy(desc(documents.createdAt));
    return NextResponse.json({ documents: docs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
