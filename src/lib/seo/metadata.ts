import type { Metadata } from "next";
import { SITE } from "@/config/site";

interface PageMetadataInput {
  title: string;
  description: string;
  /** Site-relative, e.g. "/pricing". Becomes the self-referencing canonical. */
  path: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
}

/**
 * Builds the canonical + OpenGraph + Twitter block every public page needs.
 * Written once here so a new page cannot ship with a missing canonical — the
 * failure mode that quietly splits ranking signals across duplicate URLs.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  type = "website",
  publishedTime,
  modifiedTime,
  authors,
}: PageMetadataInput): Metadata {
  // Relative — metadataBase in the root layout resolves it, so the origin is
  // never hardcoded into a page.
  const canonical = path.startsWith("/") ? path : `/${path}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type,
      siteName: SITE.name,
      locale: SITE.locale,
      url: canonical,
      title,
      description,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
      ...(type === "article" && authors ? { authors } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Metadata for authenticated pages. Keeps them out of the index even if a URL leaks. */
export const NOINDEX_METADATA: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};
