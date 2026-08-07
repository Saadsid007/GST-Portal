import type { MetadataRoute } from "next";
import { BlogService } from "@/features/blog/services/blog.service";
import { getPublicRoutes, isPrivatePath, toAbsoluteUrl } from "@/lib/seo/routes";

/**
 * Generated entirely from the route registry, so adding or deleting a page updates
 * this on the next build with no hand-editing. `lastModified` comes from real commit
 * and content dates — see scripts/generate-page-dates.mjs for why that matters.
 *
 * /login and /register are deliberately absent: see getUnlistedPublicPaths().
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = getPublicRoutes();
  const seen = new Set(routes.map((route) => route.path));

  const entries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: toAbsoluteUrl(route.path),
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Database-authored posts live outside the static data file. A failure here must not
  // take down the whole sitemap — the registry-derived entries are still valid.
  try {
    const { posts } = await BlogService.getPublishedPosts();
    for (const post of posts) {
      const path = `/blog/${post.slug}`;
      if (seen.has(path) || isPrivatePath(path)) continue;
      seen.add(path);
      entries.push({
        url: toAbsoluteUrl(path),
        lastModified: new Date(post.updatedAt),
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  } catch {
    // Static blog data already covers the common case.
  }

  return entries;
}
