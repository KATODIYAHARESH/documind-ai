import { NextResponse } from "next/server";
import { db, isDatabaseAvailable } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isDatabaseAvailable) {
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
    }
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: isDatabaseAvailable ? "database" : "demo",
      aiProvider: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? "gemini" : "mock",
      security: "enabled",
    });
  } catch (e: any) {
    return NextResponse.json({ status: "error", error: e.message }, { status: 500 });
  }
}
