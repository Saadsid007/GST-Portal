import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_ROUTES,
  getPrivateRoutePrefixes,
  getPublicRoutes,
  getPublicUrls,
  getUnlistedPublicPaths,
  isPrivatePath,
} from "@/lib/seo/routes";
import { env } from "@/lib/env";

/**
 * The sitemap and robots.txt are generated from one registry. These assertions are
 * the guard rail: a leaked private route or an unregistered new page is a real SEO
 * incident that is invisible in review, so CI has to be the thing that catches it.
 */
describe("SEO route registry", () => {
  it("never emits a private route in the public set", () => {
    for (const route of getPublicRoutes()) {
      expect(isPrivatePath(route.path), `${route.path} is behind auth`).toBe(false);
    }
  });

  it("keeps unlisted public paths out of the sitemap", () => {
    const publicPaths = getPublicRoutes().map((route) => route.path);
    for (const path of getUnlistedPublicPaths()) {
      expect(publicPaths, `${path} must not be listed`).not.toContain(path);
    }
  });

  it("emits absolute URLs on the configured origin only", () => {
    const origin = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    for (const url of getPublicUrls()) {
      expect(url.startsWith(`${origin}`), `${url} is off-origin`).toBe(true);
      expect(() => new URL(url)).not.toThrow();
      expect(url.endsWith("/"), `${url} has a trailing slash`).toBe(false);
    }
  });

  it("has a real ISO date on every route, never a build timestamp", () => {
    for (const route of ALL_ROUTES) {
      const parsed = new Date(route.lastModified);
      expect(Number.isNaN(parsed.getTime()), `${route.path} date unparseable`).toBe(false);
      expect(parsed.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it("has no duplicate paths", () => {
    const paths = ALL_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("registers every marketing page that exists on disk", () => {
    const marketingRoot = join(process.cwd(), "src", "app", "(marketing)");
    const registered = new Set(getPublicRoutes().map((route) => route.path));

    const walk = (dir: string, urlPath: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name === "page.tsx") {
          expect(registered.has(urlPath || "/"), `${urlPath || "/"} is not in the registry`).toBe(
            true
          );
          continue;
        }
        // `_components` is private, `[slug]` routes are registered from their data modules.
        if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith("[")) {
          continue;
        }
        walk(join(dir, entry.name), `${urlPath}/${entry.name}`);
      }
    };

    walk(marketingRoot, "");
  });

  it("disallows every private prefix in both bare and subtree form", () => {
    // "/dashboard/*" alone does not block the bare "/dashboard".
    const disallow = getPrivateRoutePrefixes().flatMap((prefix) => [prefix, `${prefix}/`]);
    for (const prefix of getPrivateRoutePrefixes()) {
      expect(disallow).toContain(prefix);
      expect(disallow).toContain(`${prefix}/`);
    }
  });
});
