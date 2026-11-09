import { NextRequest, NextResponse } from "next/server";
import { getSecurityHeaders } from "@/lib/security";

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get("documind_session")?.value;
  if (!cookie) return false;

  const secret = process.env.COOKIE_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const [payload, signature, extra] = cookie.split(".");
  if (!payload || !signature || extra || !/^[\da-f]{64}$/i.test(signature)) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signatureBytes = Uint8Array.from(
      signature.match(/.{2}/g) ?? [],
      (byte) => Number.parseInt(byte, 16),
    );
    const isSignatureValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(`${payload}.${secret}`),
    );
    if (!isSignatureValid) return false;

    const decodedPayload = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const session = JSON.parse(decodedPayload) as { sub?: unknown; email?: unknown; exp?: unknown };
    return typeof session.sub === "string"
      && typeof session.email === "string"
      && typeof session.exp === "number"
      && session.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  const protectedPaths = ["/dashboard", "/workspace", "/settings"];
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isProtected && !(await hasValidSession(request))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const headers = getSecurityHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/workspace/:path*", "/settings/:path*", "/api/:path*"],
};
