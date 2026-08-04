import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/features",
          "/platforms",
          "/platforms/*",
          "/pricing",
          "/docs",
          "/docs/*",
          "/blog",
          "/blog/*",
          "/about",
          "/contact",
          "/privacy-policy",
          "/terms",
          "/refund-policy",
          "/security",
          "/changelog",
          "/login",
          "/register",
        ],
        disallow: [
          "/dashboard/*",
          "/convert/*",
          "/history/*",
          "/profile/*",
          "/settings/*",
          "/api/*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
