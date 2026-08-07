/**
 * Writes src/lib/seo/page-dates.generated.json — the real last-commit time of every
 * file that backs a public URL.
 *
 * Runs at prebuild, never at request time. Using `new Date()` in sitemap.ts instead
 * would mark every page as changed on every deploy, which trains crawlers to ignore
 * the lastModified signal entirely.
 *
 * The output is committed so typecheck and tests have a file to import; the build
 * regenerates it, so it self-corrects and never needs hand-editing.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = process.cwd();
const MARKETING_DIR = join(REPO_ROOT, "src", "app", "(marketing)");
const OUTPUT = join(REPO_ROOT, "src", "lib", "seo", "page-dates.generated.json");

/** Shallow-stable fallback for a checkout with no git history (some CI clones). */
const FALLBACK_ISO = "2025-01-01T00:00:00.000Z";

function gitLastModified(absolutePath) {
  try {
    const iso = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", relative(REPO_ROOT, absolutePath)],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    return iso ? new Date(iso).toISOString() : FALLBACK_ISO;
  } catch {
    return FALLBACK_ISO;
  }
}

/**
 * Maps a (marketing) page file to its URL path. Route groups drop out of the URL and
 * dynamic segments are skipped — those URLs come from the data files, not the filesystem.
 */
function collectStaticPages(dir, segments = []) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_") || entry.name.startsWith("[")) continue;
      found.push(...collectStaticPages(full, [...segments, entry.name]));
    } else if (entry.name === "page.tsx") {
      found.push({ path: `/${segments.join("/")}`.replace(/\/$/, "") || "/", file: full });
    }
  }
  return found;
}

const dates = {};

for (const page of collectStaticPages(MARKETING_DIR)) {
  dates[page.path] = gitLastModified(page.file);
}

// The three data modules back every dynamic URL. A URL's honest date is the later of
// its own `updatedAt` field and the commit that last touched the module — an edit to
// the shared file is a real content change even when nobody bumped the field.
for (const name of ["blog-data", "docs-data", "platforms-data"]) {
  const file = join(REPO_ROOT, "src", "lib", "seo", `${name}.ts`);
  if (existsSync(file)) dates[`@${name}`] = gitLastModified(file);
}

writeFileSync(OUTPUT, `${JSON.stringify(dates, null, 2)}\n`, "utf8");
process.stdout.write(`[seo] wrote ${Object.keys(dates).length} page dates\n`);
