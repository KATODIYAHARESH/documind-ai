import { createHmac, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "user";
}

const SESSION_COOKIE = "documind_session";
const globalForAuth = globalThis as typeof globalThis & { __documindSessionSecret?: string };
const SIGNING_SECRET = process.env.COOKIE_SECRET
  || (globalForAuth.__documindSessionSecret ??= randomBytes(32).toString("base64url"));

function sign(value: string): string {
  return createHmac("sha256", SIGNING_SECRET).update(value).digest("hex");
}

function encodePayload(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function readSession(cookieValue: string | undefined): SessionUser | null {
  if (!cookieValue) return null;

  const [payloadPart, signature, extra] = cookieValue.split(".");
  if (!payloadPart || !signature || extra) return null;

  const expected = sign(`${payloadPart}.${SIGNING_SECRET}`);
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const payload = decodePayload(payloadPart);
  if (
    !payload
    || typeof payload.email !== "string"
    || typeof payload.sub !== "string"
    || typeof payload.exp !== "number"
    || payload.exp <= Math.floor(Date.now() / 1000)
  ) return null;

  return {
    id: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : payload.email.split("@")[0],
    role: "user",
  };
}

export function createSessionCookie(user: SessionUser): string {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    iat: Math.floor(Date.now() / 1000),
  };

  const encoded = encodePayload(payload);
  const signature = sign(`${encoded}.${SIGNING_SECRET}`);
  return `${encoded}.${signature}`;
}

export function readSessionFromRequest(req: NextRequest): SessionUser | null {
  return readSession(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    return readSession(cookieStore.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export function setSessionCookie(response: Response, user: SessionUser): void {
  const value = createSessionCookie(user);
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.set("Set-Cookie", `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secureFlag}`);
}

export function clearSessionCookie(response: Response): void {
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.set("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`);
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i];
  return result === 0;
}
