import type { Metadata } from "next";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";

// Login and register are intentionally absent from the sitemap and must not be
// indexed — they are unlisted public routes, not content.
export const metadata: Metadata = NOINDEX_METADATA;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
