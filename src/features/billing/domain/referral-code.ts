import { randomBytes } from "node:crypto";
import {
  REFERRAL_CODE_PREFIX,
  REFERRAL_TOKEN_TTL_HOURS,
} from "@/features/billing/constants/billing.constants";

/**
 * Crockford-style alphabet: no I, O, 0 or 1, so a code read aloud or copied by
 * hand cannot be mistyped into a different valid code.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomString(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  }
  return out;
}

/** Permanent per-user referral code, e.g. `GSTP-4D82FK`. */
export function generateReferralCode(): string {
  return `${REFERRAL_CODE_PREFIX}-${randomString(6)}`;
}

/** Single-use 24h share token, visually distinct from a permanent code. */
export function generateShareToken(): string {
  return `${REFERRAL_CODE_PREFIX}T-${randomString(8)}`;
}

export function shareTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + REFERRAL_TOKEN_TTL_HOURS * 60 * 60 * 1000);
}

/** Admin-issued credit code, e.g. `GIFT-7K2MQX`. */
export function generateCreditCode(prefix = "GIFT"): string {
  return `${prefix}-${randomString(6)}`;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
