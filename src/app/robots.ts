import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getPrivateRoutePrefixes } from "@/lib/seo/routes";

/**
 * Generated from the same registry as sitemap.ts, so the two can never disagree about
 * which routes are public.
 *
 * AI crawlers (GPTBot, CCBot, Google-Extended, PerplexityBot) are deliberately allowed.
 * These marketing pages are public documentation, not proprietary content, and being
 * cited in AI answers is free distribution for a discovery-stage product.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  // Both forms per prefix: "/dashboard/*" alone does not block the bare "/dashboard".
  const disallow = getPrivateRoutePrefixes().flatMap((prefix) => [prefix, `${prefix}/`]);

  return {
    rules: [
      {
        userAgent: "*",
        // Allow-by-default. Enumerating public paths here duplicates the sitemap and
        // silently drops any page nobody remembered to add.
        allow: "/",
        disallow,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
