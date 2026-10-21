/**
 * Brand constants that Client Components may import.
 *
 * `SITE` (config/site) reads the validated server env, which pulls zod into
 * the browser bundle — the sidebar importing it for the product name shipped
 * ~64KB of zod on every signed-in page. Anything a client needs lives here,
 * free of `@/lib/env`; SITE re-exports it so the values never drift.
 */
export const BRAND_NAME = "GSTPilot";

export const SUPPORT_EMAIL = "gstpilot.official@gmail.com";
