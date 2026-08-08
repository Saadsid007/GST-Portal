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

  // AI Mapping Configuration
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GROK_API_KEY: z.string().optional(),
  GROK_MODEL: z.string().default("openai/gpt-oss-120b"),

  // Bootstrap admin, read by `prisma/seed.ts` only. Kept out of the code so the
  // credentials never live in the repository.
  ADMIN_SEED_EMAIL: z.string().optional(),
  ADMIN_SEED_PASSWORD: z.string().optional(),

  // Search-engine indexing. All optional: with none of these set the notifier no-ops
  // and the sitemap alone drives discovery.
  INDEXNOW_KEY: z.string().optional(),
  INDEXNOW_KEY_LOCATION: z.string().optional(),
  GOOGLE_INDEXING_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  /** Where the deploy-time URL manifest lives. Overridden in CI so it can be cached. */
  SEO_MANIFEST_PATH: z.string().optional().default(".seo-cache/url-manifest.json"),
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
  INDEXNOW_KEY: process.env["INDEXNOW_KEY"],
  INDEXNOW_KEY_LOCATION: process.env["INDEXNOW_KEY_LOCATION"],
  GOOGLE_INDEXING_ENABLED: process.env["GOOGLE_INDEXING_ENABLED"],
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  GEMINI_API_KEY: process.env["GEMINI_API_KEY"],
  GEMINI_MODEL: process.env["GEMINI_MODEL"],
  GROK_API_KEY: process.env["GROK_API_KEY"],
  GROK_MODEL: process.env["GROK_MODEL"],
  SEO_MANIFEST_PATH: process.env["SEO_MANIFEST_PATH"],
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
