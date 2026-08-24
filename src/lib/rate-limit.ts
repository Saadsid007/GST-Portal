/**
 * Fixed-window rate limiter, backed by the database.
 *
 * Every unauthenticated entry point needs one. Without it the OTP endpoints are
 * an email bomb aimed at any address an attacker knows, and the verify endpoints
 * are a brute-force oracle against a 6-digit code.
 *
 * Deliberately DB-backed rather than an in-memory Map: a Map resets on every
 * deploy and is per-instance, and a process restart is precisely when an
 * attacker retries.
 */

import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ module: "rate-limit" });

/**
 * Centralized limits. Tuned so a real person never meets them: a user asking for
 * a fresh OTP three times in ten minutes is already unusual.
 */
export const RATE_LIMITS = {
  /** OTP emails per address. The expensive, abusable side — it sends mail. */
  otpRequest: { limit: 3, windowMs: 10 * 60 * 1000 },
  /** OTP verification attempts per address, across codes. */
  otpVerify: { limit: 10, windowMs: 10 * 60 * 1000 },
  /** Password-reset completions per address. */
  passwordReset: { limit: 5, windowMs: 30 * 60 * 1000 },
  /** Public contact form submissions per address. */
  contactForm: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  /** Attempts left in the current window. */
  remaining: number;
  /** When the window resets — used to tell the user when to try again. */
  resetAt: Date;
}

/**
 * Consumes one unit against `action:subject`.
 *
 * Fails **open** on a database error: a limiter outage must not lock everyone
 * out of password reset. The failure is logged so it is visible.
 */
export async function consumeRateLimit(
  action: RateLimitAction,
  subject: string,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const { limit, windowMs } = RATE_LIMITS[action];
  const key = `${action}:${subject.toLowerCase().trim()}`;
  const resetAt = new Date(now.getTime() + windowMs);

  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    // No row, or the previous window has expired: start a fresh one.
    if (!existing || existing.resetAt <= now) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    if (existing.count >= limit) {
      logger.warn({ action, key }, "Rate limit exceeded");
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    const updated = await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - updated.count),
      resetAt: updated.resetAt,
    };
  } catch (err) {
    logger.error({ err, action }, "Rate limiter unavailable — allowing request");
    return { allowed: true, remaining: 0, resetAt };
  }
}

/** Clears a subject's counter. Called after a legitimately completed flow. */
export async function resetRateLimit(action: RateLimitAction, subject: string): Promise<void> {
  const key = `${action}:${subject.toLowerCase().trim()}`;
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/** Human-readable "try again in N minutes" for user-facing errors. */
export function retryAfterMessage(resetAt: Date, now: Date = new Date()): string {
  const minutes = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 60000));
  return `Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
