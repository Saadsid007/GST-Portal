import Link from "next/link";
import { FileSpreadsheet, ShieldCheck, Lock } from "lucide-react";
import { MarketingNav } from "./_components/marketing-nav";
import { OfferStrip } from "@/features/announcements/presentation/offer-strip";
import { getActiveAnnouncements } from "@/features/announcements/services/announcement.service";

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Supported platforms", href: "/platforms" },
      { label: "Pricing", href: "/pricing" },
      { label: "Converter workbench", href: "/convert" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Amazon MTR guide", href: "/docs/how-to-upload-amazon-b2b-report" },
      { label: "Meesho return guide", href: "/docs/how-to-upload-meesho-sales-report" },
      { label: "GST compliance blog", href: "/blog" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Contact sales", href: "/contact" },
      { label: "Security model", href: "/security" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Refund policy", href: "/refund-policy" },
    ],
  },
];

/**
 * Server component. Only the header nav and theme toggle are client islands,
 * so marketing pages stream their content instead of blocking on hydration.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Cached and tagged, so this costs no query until an admin edits the strip.
  const announcements = await getActiveAnnouncements();

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <OfferStrip announcements={announcements} />

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl brand-gradient text-primary-foreground shadow-accent transition-transform duration-200 group-hover:scale-105">
              <FileSpreadsheet className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-lg leading-none font-bold tracking-tight">
                GSTPilot
              </span>
              <span className="mt-1 hidden font-mono text-2xs leading-none text-muted-foreground sm:block">
                Marketplace → GSTR-1
              </span>
            </div>
          </Link>

          <MarketingNav />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-subtle">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg brand-gradient text-primary-foreground">
                  <FileSpreadsheet className="size-4" aria-hidden />
                </div>
                <span className="text-sm font-bold">GSTPilot</span>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                Convert marketplace reports from Amazon, Flipkart, Meesho, Myntra and more into
                government-compatible GSTR-1 JSON and Excel in seconds.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-2xs font-medium text-muted-foreground">
                  <Lock className="size-3" aria-hidden /> TLS 1.3 encrypted
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-2xs font-medium text-muted-foreground">
                  <ShieldCheck className="size-3" aria-hidden /> GSTN v3.0 compliant
                </span>
              </div>
            </div>

            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading} className="space-y-3">
                <p className="text-2xs font-bold tracking-wider text-foreground uppercase">
                  {col.heading}
                </p>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
            <p className="text-2xs text-muted-foreground">
              © {new Date().getFullYear()} GSTPilot. All rights reserved.
            </p>
            <p className="text-2xs text-muted-foreground">
              Built for Indian e-commerce sellers and their CAs.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
