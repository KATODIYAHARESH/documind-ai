import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, readSessionFromRequest } from "@/lib/auth";
import { sanitizeInput, checkRateLimit } from "@/lib/security";
import { verifyCredentials } from "@/lib/user-store";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    const email = sanitizeInput(String(body.email || ""), 255).toLowerCase();
    const password = String(body.password || "").slice(0, 255);
    const limit = checkRateLimit(`auth:${email || "anon"}`, 10, 60_000);

    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many login attempts. Please wait a minute and try again." }, { status: 429 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      return NextResponse.json({ error: "A valid email and password are required." }, { status: 400 });
    }

    const user = verifyCredentials(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
      message: "Login successful.",
    });

    const cookie = createSessionCookie({ id: user.id, email: user.email, name: user.name, role: "user" });
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.headers.set("Set-Cookie", `documind_session=${cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secureFlag}`);
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Login failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = readSessionFromRequest(req);
  return NextResponse.json({ authenticated: Boolean(user), user: user || null });
}
