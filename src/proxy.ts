import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { REQUESTED_PATH_HEADER } from "@/features/auth/domain/safe-next";

/**
 * A cheap first gate in front of the signed-in areas: no session cookie, no
 * page. The layouts make the real decision against the database — a cookie
 * can outlive its session.
 *
 * Only these prefixes require a session. Everything else — the marketing site,
 * docs, blog, legal pages — is public, so the list is a whitelist of protected
 * areas rather than a whitelist of public ones. Adding a marketing page must
 * never accidentally put it behind the login wall.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/convert",
  "/pdf-extractor",
  "/profile",
  "/history",
  "/settings",
  "/billing",
  "/refer",
  "/support",
  "/admin",
] as const;

// Sits under /admin, which is otherwise protected. Without this exemption the
// admin sign-in screen requires a session to reach — i.e. it is unreachable
// for exactly the person who needs it.
const PUBLIC_UNDER_PROTECTED = ["/admin/login"] as const;

function matches(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(route + "/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_UNDER_PROTECTED.some((route) => matches(pathname, route))) {
    return NextResponse.next();
  }

  // Signed-in visitors used to be bounced off /login and /register here on
  // the cookie alone. A cookie outlives its session — it expires, or the
  // account is deleted — and then /login sent them to /dashboard, which sent
  // them back to /login: a redirect loop, and a sign-in page that never
  // opened. Only the absence of a cookie is decided here.
  if (!PROTECTED_PREFIXES.some((route) => matches(pathname, route))) {
    return NextResponse.next();
  }

  const requested = pathname + request.nextUrl.search;
  if (!getSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", requested);
    return NextResponse.redirect(loginUrl);
  }

  // A cookie whose session has expired gets this far, and the layout then
  // sends it to /login. Layouts cannot see the URL, so pass it along: the
  // person returns to the page they asked for. Always overwritten, never
  // taken from the client; the login page sanitises it again anyway.
  const headers = new Headers(request.headers);
  headers.set(REQUESTED_PATH_HEADER, requested);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
