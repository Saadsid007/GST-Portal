"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, Sun, Moon, X, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui";

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Platforms", href: "/platforms" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
];

/**
 * The only interactive part of the marketing header. Isolating it here lets the
 * layout itself stay a server component, so marketing pages stream instead of
 * waiting on the client bundle.
 */
export function MarketingNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden items-center gap-0.5 rounded-full border border-border/70 bg-muted/50 p-1 text-xs font-semibold md:flex"
      >
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors duration-200",
                isActive
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
        <ThemeToggle />

        <Link
          href="/login"
          className="hidden px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
        >
          Sign in
        </Link>

        <Button asChild variant="brand" size="sm">
          <Link href="/convert">
            <Zap />
            <span className="hidden sm:inline">Start free conversion</span>
            <span className="sm:hidden">Convert</span>
          </Link>
        </Button>

        <Button
          variant="outline"
          size="icon-sm"
          className="md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {menuOpen && (
        <nav
          aria-label="Mobile"
          className="absolute inset-x-0 top-full animate-rise border-t border-border bg-background px-4 py-3 text-sm font-semibold shadow-lg md:hidden"
        >
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2.5 transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary-ink"
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
            className="mt-1 block border-t border-border px-3 pt-3 pb-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
        </nav>
      )}
    </>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known on the client; the first paint must match the
  // server HTML or React throws a hydration mismatch on the icon.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
