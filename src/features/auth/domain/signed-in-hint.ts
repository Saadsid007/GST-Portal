/**
 * A readable cookie that says only "this browser has a session cookie".
 *
 * The session cookie itself is httpOnly, so on the static marketing pages the
 * nav could not tell a signed-in visitor apart until the auth client had
 * loaded and /api/auth/get-session had answered, which on a cold function took
 * a second or two of "Sign in" before "Go to dashboard" appeared. The proxy
 * keeps this hint in step with the session cookie on every request, and the
 * nav reads it on first render.
 *
 * It grants nothing: it only picks which button to show. Every signed-in page
 * still checks the real session against the database.
 */
export const SIGNED_IN_HINT_COOKIE = "gp_signed_in";

export function hasSignedInHint(cookieHeader: string): boolean {
  return cookieHeader.split(";").some((part) => part.trim() === `${SIGNED_IN_HINT_COOKIE}=1`);
}
