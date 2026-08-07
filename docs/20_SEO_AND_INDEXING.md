# 20 — SEO & Automatic Indexing

How GSTPilot's sitemap, robots.txt, structured data and search-engine notification work,
and what a developer has to do when adding a page.

## 1. The one rule

**Every public page must have an entry in `src/lib/seo/routes.ts`.** Nothing else needs
touching. The sitemap, robots.txt, `lastModified` dates and the deploy-time indexing ping
all derive from that registry.

A unit test (`tests/unit/seo-registry.test.ts`) walks `src/app/(marketing)` on disk and
fails CI if a `page.tsx` exists without a registry entry. You cannot forget this silently.

## 2. Adding a page

### A static marketing page

1. Create `src/app/(marketing)/<path>/page.tsx`.
2. Export metadata via the shared builder — never hand-roll canonical or OG tags:

   ```ts
   export const metadata: Metadata = buildPageMetadata({
     title: "Page title",
     description: "One or two sentences, written for a human.",
     path: "/your-path",
   });
   ```

3. Add the route to `STATIC_ROUTES` in `src/lib/seo/routes.ts` with a `changeFrequency`
   and a `priority` reflecting commercial intent.
4. Commit. The date is derived automatically (§3).

### A dynamic page (blog / docs / platform)

Add the item to its data module (`blog-data.ts`, `docs-data.ts`, `platforms-data.ts`).
The registry expands those modules into routes on its own — no registry edit needed.

### A private page

Add its prefix to `PRIVATE_ROUTE_PREFIXES`. That single list drives both the sitemap
exclusion and the robots.txt `Disallow` block, so they cannot drift apart. Private
layouts also export `NOINDEX_METADATA`, because a crawler arriving from an external
link honours the header even when it never read robots.txt.

## 3. How `lastModified` is derived

**Never from `new Date()`.** A build timestamp marks every page as changed on every
deploy, which trains crawlers to ignore the signal entirely.

Instead, `scripts/generate-page-dates.mjs` runs at `prebuild` and asks git:

```
git log -1 --format=%cI -- <file>
```

for each `page.tsx`, writing `src/lib/seo/page-dates.generated.json`. Dynamic routes take
the **later** of the item's own `updatedAt` and the commit that last touched the shared
data module — editing that module is a real change even if the per-item field was not
bumped.

CI must therefore check out with `fetch-depth: 0`. A shallow clone has no history to read
dates from, and every page silently falls back to `2025-01-01`.

## 4. How indexing is triggered

On every push to `main`, `.github/workflows/seo-indexing.yml`:

1. Builds the current list of public URLs.
2. Diffs it against the previous run's manifest, restored from `actions/cache`.
   _The manifest is deliberately **not** committed — committing it would trigger a
   deploy, which triggers the workflow, which commits again._
3. Submits changed URLs as `URL_UPDATED` and removed URLs as `URL_DELETED`.
4. Saves the new manifest back to the cache.

The first run records a baseline and submits nothing — there is no point spending quota
re-announcing pages crawlers already have.

The step is `continue-on-error: true` and the script exits 0 even on failure. An indexing
ping must never be able to fail a deploy.

### Providers

| Provider                | Status                                | Notes                                                                                                                                       |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **IndexNow**            | Primary                               | Bing, Yandex, Seznam, Naver. Fully supported, 10,000 URLs/batch.                                                                            |
| **Google Indexing API** | Optional accelerator, default **off** | Officially only for `JobPosting` / `BroadcastEvent`. Often works for ordinary pages, but that is out of policy and revocable. 200 URLs/day. |
| Google sitemap ping     | Gone                                  | Retired 2023.                                                                                                                               |
| Bing sitemap ping       | Gone                                  | Retired 2025.                                                                                                                               |

Google discovers pages through the sitemap. The Indexing API only reduces discovery
latency, and nothing in the system is load-bearing on it.

**Indexing is not ranking.** This system controls how fast Google _finds_ a page. What it
does with it afterwards is down to the content.

## 5. Environment variables

All read through `@/lib/env` — never `process.env` directly.

| Var                           | Where                             | Required                    | Purpose                                                                                    |
| ----------------------------- | --------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_APP_URL`         | Vercel + GitHub repo **variable** | Yes                         | `https://gstpilot.cloud`. Origin for every canonical URL, sitemap entry and JSON-LD `@id`. |
| `INDEXNOW_KEY`                | Vercel + GitHub **secret**        | No                          | Enables IndexNow. Any 8–128 char hex string.                                               |
| `INDEXNOW_KEY_LOCATION`       | Vercel                            | No                          | Override the key file URL. Defaults to `/<key>.txt`.                                       |
| `GOOGLE_INDEXING_ENABLED`     | Vercel + GitHub                   | No                          | `"true"` / `"false"`, default `false`.                                                     |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Vercel + GitHub **secret**        | Only if the above is `true` | Full service-account key JSON.                                                             |
| `SEO_MANIFEST_PATH`           | GitHub Actions                    | No                          | Manifest location, default `.seo-cache/url-manifest.json`.                                 |

## 6. First-time setup

### IndexNow

1. Generate a key: `openssl rand -hex 16`.
2. Set it as `INDEXNOW_KEY` in Vercel and as a GitHub Actions secret.
3. Verify `https://gstpilot.cloud/<key>.txt` returns the key as plain text. It is served by
   `src/app/api/indexnow/[key]/route.ts` via a hex-constrained rewrite in `next.config.ts`,
   so the key itself is never committed.

### Google Search Console

1. Add `https://gstpilot.cloud` as a **domain** property and verify via DNS TXT.
2. Submit `https://gstpilot.cloud/sitemap.xml` once. It is re-read automatically after that.

### Bing Webmaster Tools

Import the property from Search Console — it carries the verification across.

### Google Indexing API (optional)

1. Create a Google Cloud project, enable **Indexing API**.
2. Create a service account, download the JSON key.
3. In Search Console → Settings → Users and permissions, add the service account's
   `client_email` as an **Owner**. Anything less and every call returns 403.
4. Set `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_INDEXING_ENABLED=true`.

## 7. Structured data

`src/lib/seo/structured-data.ts` holds every schema builder; render with `<JsonLd schema={…} />`.

- `organizationSchema`, `webSiteSchema`, `softwareApplicationSchema` — homepage only.
- `blogPostingSchema`, `articleSchema`, `faqPageSchema`, `breadcrumbSchema`, `productSchema`.

Two deliberate omissions:

- **No `aggregateRating`.** Ratings we cannot substantiate are a manual-action risk.
- **No per-platform `SoftwareApplication`.** One product, one entity; duplicating it across
  ten platform pages reads as spam.

Every URL inside a schema goes through `toAbsoluteUrl()`. Hardcoded domains have bitten this
codebase before — three different wrong domains were live in JSON-LD at one point.

## 8. Files

| File                                 | Role                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| `src/lib/seo/routes.ts`              | The registry. Single source of truth.                   |
| `src/lib/seo/metadata.ts`            | `buildPageMetadata`, `NOINDEX_METADATA`.                |
| `src/lib/seo/structured-data.ts`     | JSON-LD builders.                                       |
| `src/lib/seo/indexing.ts`            | `notifySearchEngines`. Never throws.                    |
| `src/app/sitemap.ts` / `robots.ts`   | Generated from the registry.                            |
| `src/app/opengraph-image.tsx`        | Root social card, inherited by pages with no own image. |
| `scripts/generate-page-dates.mjs`    | Git-derived dates, runs at prebuild.                    |
| `scripts/notify-indexing.ts`         | Manifest diff + submission.                             |
| `.github/workflows/seo-indexing.yml` | Post-deploy trigger.                                    |
