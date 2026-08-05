"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, Menu, Sun, Moon, X, Zap, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";

interface Props {
  children: React.ReactNode;
}

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Platforms", href: "/platforms" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
];

export default function MarketingLayout({ children }: Props) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  // The theme is only known on the client, so the first paint must match the
  // server HTML or React throws a hydration mismatch on the icon.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Top Banner. Wraps rather than crushing the icon on a phone. */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-gradient-to-r from-primary via-violet-600 to-indigo-600 px-4 py-2 text-center text-[11px] font-semibold text-white sm:text-xs">
        <Sparkles className="size-3.5 flex-shrink-0" />
        <span>
          GSTPilot v2.5 Released — Full support for Amazon MTR v3, Meesho Returns & TCS
          Reconciliation!
        </span>
        <Link href="/convert" className="font-bold underline hover:opacity-90">
          Try Now →
        </Link>
      </div>

      {/* Header Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all group-hover:scale-105">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-lg leading-none font-bold tracking-tight">
                GSTPilot
              </span>
              <span className="mt-0.5 hidden font-mono text-[10px] leading-none text-muted-foreground sm:block">
                Marketplace → GSTR-1
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden items-center gap-1 rounded-full border border-border/50 bg-muted/40 p-1 text-xs font-semibold md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-4 py-1.5 transition-all",
                    isActive
                      ? "bg-background font-bold text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              title="Toggle theme"
            >
              {mounted && theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </button>

            <Link
              href="/login"
              className="hidden px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground sm:inline-flex"
            >
              Sign In
            </Link>

            <Link
              href="/convert"
              className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:px-4"
            >
              <Zap className="size-3.5 flex-shrink-0" />
              {/* The full label alone is ~155px; on a phone the icon carries the meaning. */}
              <span className="hidden sm:inline">Start Free Conversion</span>
              <span className="sm:hidden">Convert</span>
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu. Without this the five nav links were unreachable below md, leaving the
            footer as the only way to move between marketing pages. */}
        {menuOpen && (
          <nav className="border-t border-border/60 bg-background px-4 py-3 text-sm font-semibold md:hidden">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 transition",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-1 block rounded-lg border-t border-border px-3 pt-3 pb-2 text-muted-foreground transition hover:text-foreground"
            >
              Sign In
            </Link>
          </nav>
        )}
      </header>

      {/* Main Page Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 pt-16 pb-12 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl space-y-12 px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
                  <FileSpreadsheet className="size-4" />
                </div>
                <span className="text-sm font-bold text-foreground">GSTPilot</span>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                Specialized SaaS tool for converting marketplace reports (Amazon, Flipkart, Meesho,
                Myntra, etc.) into official government-compatible GSTR-1 JSON & Excel files in
                seconds.
              </p>
              <p className="text-[11px] text-muted-foreground">
                © {new Date().getFullYear()} GSTPilot. All rights reserved.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold tracking-wider text-foreground uppercase">
                Product
              </p>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/features" className="hover:underline">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/platforms" className="hover:underline">
                    Supported Platforms
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:underline">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/convert" className="hover:underline">
                    Converter Workbench
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold tracking-wider text-foreground uppercase">
                Resources
              </p>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/docs" className="hover:underline">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/docs/how-to-upload-amazon-b2b-report" className="hover:underline">
                    Amazon MTR Guide
                  </Link>
                </li>
                <li>
                  <Link href="/docs/how-to-upload-meesho-sales-report" className="hover:underline">
                    Meesho Return Guide
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:underline">
                    GST Compliance Blog
                  </Link>
                </li>
                <li>
                  <Link href="/changelog" className="hover:underline">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold tracking-wider text-foreground uppercase">
                Legal & Trust
              </p>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/about" className="hover:underline">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:underline">
                    Contact Sales
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="hover:underline">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:underline">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="hover:underline">
                    Security Model
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
