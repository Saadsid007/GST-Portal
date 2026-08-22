import Link from "next/link";
import { ShieldCheck, Lock } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
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
      { label: "Guides & blog", href: "/blog" },
      { label: "What's new", href: "/changelog" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Security & privacy", href: "/security" },
      { label: "Contact support", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Refund Policy", href: "/refund-policy" },
      { label: "Delivery Policy", href: "/shipping-policy" },
      { label: "Disclaimer", href: "/disclaimer" },
    ],
  },
];

/**
 * Server component. Only the header nav and theme toggle are client islands,
 * so marketing pages stream their content instead of blocking on hydration.
 */
import { getServerSession } from "@/features/auth/infrastructure/session.service";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Cached and tagged, so this costs no query until an admin edits the strip.
  const [announcements, session] = await Promise.all([
    getActiveAnnouncements(),
    getServerSession(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <OfferStrip announcements={announcements} />

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2.5 transition-transform hover:opacity-95"
          >
            <AppLogo size="lg" priority />
          </Link>

          <MarketingNav initialSession={session ? { user: session.user } : null} />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-subtle">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center">
                <AppLogo size="md" />
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
            <p className="flex items-center gap-1 text-2xs text-muted-foreground">
              Developed by{" "}
              <a
                href="https://growthtechnos.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
              >
                Growth Technos
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
