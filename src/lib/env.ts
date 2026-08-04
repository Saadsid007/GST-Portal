import { z } from "zod";

const isServer = typeof window === "undefined";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: isServer ? z.string().min(1, "DATABASE_URL is required") : z.string().optional(),
  BETTER_AUTH_SECRET: isServer
    ? z.string().min(1, "BETTER_AUTH_SECRET is required")
    : z.string().optional(),
  BETTER_AUTH_URL: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Razorpay. Server-only secrets stay optional on the client bundle, the same
  // way DATABASE_URL does, so importing env from a Client Component never throws.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),

  // Bootstrap admin, read by `prisma/seed.ts` only. Kept out of the code so the
  // credentials never live in the repository.
  ADMIN_SEED_EMAIL: z.string().optional(),
  ADMIN_SEED_PASSWORD: z.string().optional(),
});

export const env = envSchema.parse({
  NODE_ENV: process.env["NODE_ENV"],
  NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
  DATABASE_URL: process.env["DATABASE_URL"],
  BETTER_AUTH_SECRET: process.env["BETTER_AUTH_SECRET"],
  BETTER_AUTH_URL: process.env["BETTER_AUTH_URL"],
  LOG_LEVEL: process.env["LOG_LEVEL"],
  RAZORPAY_KEY_ID: process.env["RAZORPAY_KEY_ID"],
  RAZORPAY_KEY_SECRET: process.env["RAZORPAY_KEY_SECRET"],
  RAZORPAY_WEBHOOK_SECRET: process.env["RAZORPAY_WEBHOOK_SECRET"],
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env["NEXT_PUBLIC_RAZORPAY_KEY_ID"],
  ADMIN_SEED_EMAIL: process.env["ADMIN_SEED_EMAIL"],
  ADMIN_SEED_PASSWORD: process.env["ADMIN_SEED_PASSWORD"],
});

/**
 * Razorpay credentials, asserted present. Call this only from server code that is
 * about to talk to Razorpay — it fails loudly at the point of use rather than
 * breaking every page render when the keys are missing in a dev environment.
 */
export function requireRazorpayEnv(): {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
} {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !RAZORPAY_WEBHOOK_SECRET) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET."
    );
  }
  return {
    keyId: RAZORPAY_KEY_ID,
    keySecret: RAZORPAY_KEY_SECRET,
    webhookSecret: RAZORPAY_WEBHOOK_SECRET,
  };
}
