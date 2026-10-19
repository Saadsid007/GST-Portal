import crypto from "crypto";
import { env } from "@/lib/env";

/**
 * Signed unsubscribe links.
 *
 * Every campaign email links to an unsubscribe page, and Gmail and Yahoo
 * require one-click unsubscribe for bulk senders. The link carries the address
 * and an HMAC of it, so it works without signing in but cannot be forged:
 * knowing someone's email is not enough to unsubscribe them.
 */
function sign(email: string): string {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required to sign unsubscribe links");
  return crypto
    .createHmac("sha256", secret)
    .update(`unsubscribe:${email.toLowerCase().trim()}`)
    .digest("base64url")
    .slice(0, 32);
}

export function unsubscribeToken(email: string): string {
  return sign(email);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(sign(email));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function query(email: string): string {
  return `e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`;
}

/** The page a person opens from the email footer. */
export function unsubscribePageUrl(baseUrl: string, email: string): string {
  return `${baseUrl}/unsubscribe?${query(email)}`;
}

/** The RFC 8058 one-click endpoint mail clients POST to. */
export function unsubscribeOneClickUrl(baseUrl: string, email: string): string {
  return `${baseUrl}/api/unsubscribe?${query(email)}`;
}
