/** Set by the proxy on protected requests: the path the visitor asked for. */
export const REQUESTED_PATH_HEADER = "x-gstpilot-requested-path";

/** /login, carrying the page to return to after signing in. */
export function loginPathFor(requested: string | null | undefined): string {
  const next = safeNextPath(requested, "");
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

/**
 * Where a user may be sent after signing in: a path on this site, or the
 * dashboard. `//host` and `/\host` are read by browsers as another site, so
 * anything but a plain local path is refused — otherwise the sign-in page is
 * an open redirect.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  // Control characters (tab, newline) are stripped by URL parsers and can
  // turn "/\t/host" into "//host".
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
