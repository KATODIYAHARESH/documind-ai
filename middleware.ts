import { NextResponse } from "next/server";
import { getSecurityHeaders } from "@/lib/security";

export function middleware() {
  const response = NextResponse.next();

  const headers = getSecurityHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/workspace/:path*", "/settings/:path*", "/api/:path*"],
};
