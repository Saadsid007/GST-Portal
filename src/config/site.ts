import { env } from "@/lib/env";

/**
 * Single source of truth for brand identity and canonical URLs. Metadata,
 * sitemap, robots and structured data all read from here so the name and
 * domain can never drift apart across surfaces.
 */
export const SITE = {
  name: "GSTPilot",
  url: env.NEXT_PUBLIC_APP_URL,
  defaultTitle: "GSTPilot — Marketplace reports to GSTR-1 JSON & Excel",
  description:
    "Convert Amazon, Flipkart, Meesho, Myntra and JioMart seller reports into government-compatible GSTR-1 JSON and Excel in seconds. Automatic net sales calculation, column mapping and TCS reconciliation.",
  tagline: "Marketplace → GSTR-1",
  locale: "en_IN",
  supportEmail: "support@gstpilot.cloud",
} as const;
