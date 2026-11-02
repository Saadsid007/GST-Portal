import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { REQUESTED_PATH_HEADER } from "@/features/auth/domain/safe-next";
import { SIGNED_IN_HINT_COOKIE } from "@/features/auth/domain/signed-in-hint";

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
  return withSignedInHint(request, route(request));
}

function route(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (PUBLIC_UNDER_PROTECTED.some((r) => matches(pathname, r))) {
    return NextResponse.next();
  }

  // Signed-in visitors used to be bounced off /login and /register here on
  // the cookie alone. A cookie outlives its session — it expires, or the
  // account is deleted — and then /login sent them to /dashboard, which sent
  // them back to /login: a redirect loop, and a sign-in page that never
  // opened. Only the absence of a cookie is decided here.
  if (!PROTECTED_PREFIXES.some((r) => matches(pathname, r))) {
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

/**
 * Keeps the readable signed-in hint (see signed-in-hint.ts) in step with the
 * session cookie. Written only when it changes, so most responses carry no
 * extra Set-Cookie.
 */
function withSignedInHint(request: NextRequest, response: NextResponse): NextResponse {
  const hasSession = Boolean(getSessionCookie(request));
  const hinted = request.cookies.get(SIGNED_IN_HINT_COOKIE)?.value === "1";
  if (hasSession && !hinted) {
    response.cookies.set(SIGNED_IN_HINT_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else if (!hasSession && hinted) {
    response.cookies.delete(SIGNED_IN_HINT_COOKIE);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
