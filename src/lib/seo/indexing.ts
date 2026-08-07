import crypto from "node:crypto";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { toAbsoluteUrl } from "@/lib/seo/routes";

const log = createLogger({ module: "seo/indexing" });

export type NotificationType = "URL_UPDATED" | "URL_DELETED";

export interface ProviderResult {
  provider: "indexnow" | "google";
  ok: boolean;
  submitted: number;
  skipped: number;
  status?: number;
  message?: string;
}

/** IndexNow accepts up to 10,000 URLs per request. */
const INDEXNOW_BATCH_LIMIT = 10_000;
/** Google's published quota is 200 URL notifications per project per day. */
const GOOGLE_DAILY_LIMIT = 200;
/** Refresh the OAuth token a minute early so an in-flight batch never uses a dead one. */
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

function normalise(urls: readonly string[]): string[] {
  return Array.from(
    new Set(
      urls.filter(Boolean).map((url) => (/^https?:\/\//i.test(url) ? url : toAbsoluteUrl(url)))
    )
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* ── IndexNow — Bing, Yandex, Seznam, Naver ─────────────────────────────────
   The primary, policy-compliant push channel. Google and Bing both retired their
   sitemap-ping endpoints (2023 and 2025), so there is no ping to make there. */

async function pingIndexNow(urls: string[]): Promise<ProviderResult> {
  const key = env.INDEXNOW_KEY;
  if (!key) {
    return {
      provider: "indexnow",
      ok: true,
      submitted: 0,
      skipped: urls.length,
      message: "not configured",
    };
  }

  const batch = urls.slice(0, INDEXNOW_BATCH_LIMIT);
  const skipped = urls.length - batch.length;
  if (skipped > 0) {
    log.warn(
      { skipped, limit: INDEXNOW_BATCH_LIMIT },
      "IndexNow batch limit exceeded, dropping overflow"
    );
  }

  try {
    const host = new URL(toAbsoluteUrl("/")).host;
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: env.INDEXNOW_KEY_LOCATION ?? toAbsoluteUrl(`/${key}.txt`),
        urlList: batch,
      }),
    });

    const result: ProviderResult = {
      provider: "indexnow",
      ok: response.ok,
      submitted: response.ok ? batch.length : 0,
      skipped,
      status: response.status,
    };
    log[response.ok ? "info" : "warn"](result, "IndexNow submission");
    return result;
  } catch (error) {
    const message = errorMessage(error);
    log.warn({ err: message }, "IndexNow submission failed");
    return { provider: "indexnow", ok: false, submitted: 0, skipped: urls.length, message };
  }
}

/* ── Google Indexing API — optional accelerator ──────────────────────────────
   Google officially supports this API only for JobPosting and BroadcastEvent schema.
   It frequently works for ordinary pages, but that is out of policy and Google can
   stop honouring it without notice. It is therefore behind GOOGLE_INDEXING_ENABLED
   (default false) and nothing here may become load-bearing: sitemap + IndexNow are
   the paths that must keep working when this returns nothing. */

let cachedToken: { token: string; expiresAt: number } | null = null;

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "client_email" in parsed &&
      "private_key" in parsed
    ) {
      const { client_email, private_key } = parsed as Record<string, unknown>;
      if (typeof client_email === "string" && typeof private_key === "string") {
        return { client_email, private_key };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function getGoogleAccessToken(account: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object): string =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })}`;

  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    // Escaped newlines survive round-tripping the key through an env var.
    .sign(account.private_key.replace(/\\n/g, "\n"), "base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });

  if (!response.ok) {
    log.warn({ status: response.status }, "Google token exchange failed");
    return null;
  }

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as Record<string, unknown>)["access_token"] !== "string"
  ) {
    log.warn("Google token response missing access_token");
    return null;
  }

  const token = (data as Record<string, unknown>)["access_token"] as string;
  const expiresIn = (data as Record<string, unknown>)["expires_in"];
  cachedToken = {
    token,
    expiresAt: Date.now() + (typeof expiresIn === "number" ? expiresIn : 3600) * 1000,
  };
  return token;
}

async function notifyGoogle(urls: string[], type: NotificationType): Promise<ProviderResult> {
  if (!env.GOOGLE_INDEXING_ENABLED) {
    return {
      provider: "google",
      ok: true,
      submitted: 0,
      skipped: urls.length,
      message: "disabled",
    };
  }

  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    // Enabled but unconfigured is a deployment mistake, not a silent no-op.
    log.error("GOOGLE_INDEXING_ENABLED is true but GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    return {
      provider: "google",
      ok: false,
      submitted: 0,
      skipped: urls.length,
      message: "missing service account",
    };
  }

  const account = parseServiceAccount(raw);
  if (!account) {
    log.error("GOOGLE_SERVICE_ACCOUNT_JSON is not a valid service-account key");
    return {
      provider: "google",
      ok: false,
      submitted: 0,
      skipped: urls.length,
      message: "invalid service account",
    };
  }

  const batch = urls.slice(0, GOOGLE_DAILY_LIMIT);
  const skipped = urls.length - batch.length;
  if (skipped > 0) {
    log.warn(
      { skipped, limit: GOOGLE_DAILY_LIMIT },
      "Google daily quota exceeded, dropping overflow"
    );
  }

  try {
    const token = await getGoogleAccessToken(account);
    if (!token) {
      return {
        provider: "google",
        ok: false,
        submitted: 0,
        skipped: urls.length,
        message: "no access token",
      };
    }

    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          const response = await fetch(
            "https://indexing.googleapis.com/v3/urlNotifications:publish",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ url, type }),
            }
          );
          return response.ok;
        } catch {
          return false;
        }
      })
    );

    const submitted = results.filter(Boolean).length;
    const result: ProviderResult = {
      provider: "google",
      ok: submitted === batch.length,
      submitted,
      skipped,
    };
    log[result.ok ? "info" : "warn"](result, "Google Indexing submission");
    return result;
  } catch (error) {
    const message = errorMessage(error);
    log.warn({ err: message }, "Google Indexing submission failed");
    return { provider: "google", ok: false, submitted: 0, skipped: urls.length, message };
  }
}

/**
 * Notify every configured provider. Never throws and never rejects — a search-engine
 * ping must not be able to fail a deploy or a request. Returns per-provider results so
 * the caller can decide what to log or persist.
 */
export async function notifySearchEngines(
  urls: string | readonly string[],
  type: NotificationType = "URL_UPDATED"
): Promise<ProviderResult[]> {
  const list = normalise(typeof urls === "string" ? [urls] : urls);
  if (list.length === 0) return [];

  const settled = await Promise.allSettled([pingIndexNow(list), notifyGoogle(list, type)]);

  return settled.map((outcome, index) =>
    outcome.status === "fulfilled"
      ? outcome.value
      : {
          provider: index === 0 ? ("indexnow" as const) : ("google" as const),
          ok: false,
          submitted: 0,
          skipped: list.length,
          message: errorMessage(outcome.reason),
        }
  );
}

/** Test seam: the module-level token cache would otherwise leak between cases. */
export function resetIndexingTokenCache(): void {
  cachedToken = null;
}
