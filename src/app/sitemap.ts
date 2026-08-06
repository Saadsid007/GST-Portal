import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { PLATFORMS_SEO_DATA } from "@/lib/seo/platforms-data";
import { DOCS_DATA } from "@/lib/seo/docs-data";
import { BLOG_POSTS_DATA } from "@/lib/seo/blog-data";
import { BlogService } from "@/features/blog/services/blog.service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;

  const staticPages = [
    "",
    "/features",
    "/platforms",
    "/pricing",
    "/docs",
    "/blog",
    "/about",
    "/contact",
    "/privacy-policy",
    "/terms",
    "/refund-policy",
    "/security",
    "/changelog",
    "/login",
    "/register",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));

  const platformPages = Object.keys(PLATFORMS_SEO_DATA).map((slug) => ({
    url: `${baseUrl}/platforms/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const docPages = Object.keys(DOCS_DATA).map((slug) => ({
    url: `${baseUrl}/docs/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  let blogSlugs = Object.keys(BLOG_POSTS_DATA);
  try {
    const { posts } = await BlogService.getPublishedPosts();
    if (posts.length > 0) {
      blogSlugs = Array.from(new Set([...blogSlugs, ...posts.map((p) => p.slug)]));
    }
  } catch (_err) {
    // Fallback to static blog data on error
  }

  const blogPages = blogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...platformPages, ...docPages, ...blogPages];
}
