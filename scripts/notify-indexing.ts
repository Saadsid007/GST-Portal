/**
 * Deploy-time search-engine notification.
 *
 * Diffs the current public URL set against the manifest from the previous deploy and
 * submits only what actually changed. Blanket-submitting every URL on every commit
 * gets the IndexNow key rate-limited and burns Google's 200/day quota.
 *
 * The manifest is restored and saved by actions/cache in the workflow, so nothing is
 * committed back to the repository and there is no deploy loop. A cache miss simply
 * means one deploy submits everything, which is harmless.
 *
 * Never exits non-zero: a failed ping must not fail a deploy.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "@/lib/env";
import { notifySearchEngines } from "@/lib/seo/indexing";
import { createLogger } from "@/lib/logger";
import { getPublicRoutes, toAbsoluteUrl } from "@/lib/seo/routes";

const log = createLogger({ module: "seo/notify-indexing" });

const MANIFEST_PATH = env.SEO_MANIFEST_PATH;

type Manifest = Record<string, string>;

function readManifest(path: string): Manifest | null {
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const manifest: Manifest = {};
    for (const [url, date] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof date === "string") manifest[url] = date;
    }
    return manifest;
  } catch {
    log.warn({ path }, "manifest unreadable, treating as first run");
    return null;
  }
}

function writeManifest(path: string, manifest: Manifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const current: Manifest = {};
  for (const route of getPublicRoutes()) {
    current[toAbsoluteUrl(route.path)] = route.lastModified;
  }

  const previous = readManifest(MANIFEST_PATH);

  // First run with no manifest: record the baseline and submit nothing. Pushing every
  // URL here would spend the whole daily quota on pages the crawlers already have.
  if (!previous) {
    writeManifest(MANIFEST_PATH, current);
    log.info({ urls: Object.keys(current).length }, "no previous manifest, baseline recorded");
    return;
  }

  const changed = Object.keys(current).filter((url) => previous[url] !== current[url]);
  const removed = Object.keys(previous).filter((url) => !(url in current));

  if (changed.length === 0 && removed.length === 0) {
    log.info("no URL changes since last deploy");
    writeManifest(MANIFEST_PATH, current);
    return;
  }

  if (changed.length > 0) {
    const results = await notifySearchEngines(changed, "URL_UPDATED");
    log.info({ count: changed.length, results }, "submitted updated URLs");
  }

  if (removed.length > 0) {
    const results = await notifySearchEngines(removed, "URL_DELETED");
    log.info({ count: removed.length, results }, "submitted deleted URLs");
  }

  writeManifest(MANIFEST_PATH, current);
}

main().catch((error: unknown) => {
  log.error(
    { err: error instanceof Error ? error.message : String(error) },
    "indexing notification failed"
  );
  // Deliberately exit 0 — indexing is best-effort and must never fail the pipeline.
});
