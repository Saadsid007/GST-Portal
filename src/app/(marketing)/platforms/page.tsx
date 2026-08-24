import type { Metadata } from "next";
import Link from "next/link";
import { PLATFORMS_SEO_DATA } from "@/lib/seo/platforms-data";
import { ArrowRight } from "lucide-react";
import { PlatformLogo } from "@/features/convert/presentation/platform-logo";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = buildPageMetadata({
  title: "Supported Marketplaces Directory",
  description:
    "Browse supported e-commerce marketplaces: Amazon MTR, Meesho, Flipkart, Myntra, JioMart, Shopdeck, GlowRoad, Snapdeal, and Custom Excel.",
  path: "/platforms",
});

export default function PlatformsPage() {
  const items = Object.values(PLATFORMS_SEO_DATA);
  // The SEO slug is "<id>-gst-report-generator", so its first segment is the
  // platform id the logo and accent gradient are keyed on.
  const configById = new Map(PLATFORMS_CONFIG.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 py-16">
      <JsonLd
        schema={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Marketplaces", path: "/platforms" },
        ])}
      />
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Marketplace Directory
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Supported E-Commerce Marketplaces
        </h1>
        <p className="text-sm text-muted-foreground">
          Dedicated report parsers and column mapping rules for all major Indian seller portals.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((plat) => (
          <Link
            key={plat.slug}
            href={`/platforms/${plat.slug}`}
            className="group flex flex-col justify-between space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/50 hover:bg-accent/40"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <PlatformLogo
                  id={
                    plat.slug === "custom-excel-gst-generator"
                      ? "custom"
                      : (plat.slug.split("-")[0] ?? "")
                  }
                  name={plat.name}
                  size="lg"
                  accentColor={
                    configById.get(
                      plat.slug === "custom-excel-gst-generator"
                        ? "custom"
                        : (plat.slug.split("-")[0] ?? "")
                    )?.accentColor
                  }
                />
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  {plat.badge}
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary-ink">
                {plat.name}
              </h2>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {plat.tagline}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs font-bold text-primary-ink">
              <span>View Guide & Generator</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
