import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth";
import { sanitizeInput, checkRateLimit } from "@/lib/security";
import { createUser } from "@/lib/user-store";

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
    const name = sanitizeInput(String(body.name || ""), 100);
    const email = sanitizeInput(String(body.email || ""), 255).toLowerCase();
    const password = String(body.password || "").slice(0, 255);
    const limit = checkRateLimit(`register:${email || "anon"}`, 8, 60_000);

    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many registration attempts. Please wait a bit and retry." }, { status: 429 });
    }

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      return NextResponse.json({ error: "Please provide a name, a valid email, and a password with at least 6 characters." }, { status: 400 });
    }

    let user;
    try {
      user = createUser(name, email, password);
    } catch (error) {
      if (error instanceof Error && error.message === "An account with this email already exists.") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
      message: "Account created successfully.",
    });

    const cookie = createSessionCookie({ id: user.id, email: user.email, name: user.name, role: "user" });
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.headers.set("Set-Cookie", `documind_session=${cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secureFlag}`);
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Registration failed." }, { status: 500 });
  }
}
