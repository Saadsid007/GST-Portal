import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Only these prefixes require a session. Everything else — the marketing site,
 * docs, blog, legal pages — is public, so the list is a whitelist of protected
 * areas rather than a whitelist of public ones. Adding a marketing page must
 * never accidentally put it behind the login wall.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/convert",
  "/profile",
  "/history",
  "/settings",
  "/billing",
  "/admin",
] as const;

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  // Sits under /admin, which is otherwise protected. Without this exemption the
  // admin sign-in screen requires a session to reach — i.e. it is unreachable
  // for exactly the person who needs it.
  "/admin/login",
] as const;

function isProtectedRoute(pathname: string): boolean {
  if (isAuthRoute(pathname)) return false;
  return PROTECTED_PREFIXES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  // A signed-in user has no business on the sign-in screens.
  if (isAuthRoute(pathname)) {
    return sessionCookie
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next();
  }

  if (isProtectedRoute(pathname) && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
