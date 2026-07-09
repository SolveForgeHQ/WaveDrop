import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protected routes — any pathname that starts with one of these
 * requires the user to be authenticated.
 */
const PROTECTED_PREFIXES = [
  "/waves",
  "/claim",
  "/profile",
  "/admin",
  "/contributor",
  "/maintainer",
  "/points",
  "/history",
  "/settings",
  "/orgs",
];

/**
 * The session cookie name set by @fastify/session in the backend.
 */
const SESSION_COOKIE = "wavedrop_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Check for the session cookie. The middleware can't call the backend API,
  // so we use cookie presence as a lightweight signal. The actual auth check
  // happens in useAuthGuard on the client.
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|docs|api).*)",
  ],
};
