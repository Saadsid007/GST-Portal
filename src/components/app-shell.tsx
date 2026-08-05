"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  History,
  Settings,
  FileSpreadsheet,
  LogOut,
  Menu,
  Moon,
  Sun,
  ChevronRight,
  X,
  Zap,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "next-themes";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

interface AppShellProps {
  children: React.ReactNode;
  user: { name: string; email: string };
  showAdmin?: boolean;
}

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "GST Profile", href: "/profile", icon: Building2 },
  { label: "Convert", href: "/convert", icon: Zap, accent: true },
  { label: "History", href: "/history", icon: History },
  { label: "Wallet", href: "/billing", icon: Wallet },
  { label: "Settings", href: "/settings", icon: Settings },
];

const ADMIN_NAV = { label: "Admin", href: "/admin", icon: ShieldCheck };

export function AppShell({ children, user, showAdmin = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The theme is only known on the client, so the first paint must match the server HTML.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  async function handleSignOut() {
    await authClient.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-5">
        <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
          <FileSpreadsheet className="size-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm leading-none font-bold">GSTTool</p>
          <p className="mt-0.5 truncate text-[10px] leading-none text-muted-foreground">
            Marketplace → GSTR-1
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {[...NAV, ...(showAdmin ? [ADMIN_NAV] : [])].map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "accent" in item && item.accent
                    ? "border border-dashed border-primary/40 text-primary hover:border-primary/70 hover:bg-primary/10"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="size-4 flex-shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {isActive && <ChevronRight className="size-3 flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="space-y-1 border-t border-border px-3 pt-4 pb-4">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          {mounted && theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          <span>{mounted && theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          <span>Sign Out</span>
        </button>

        {/* User info */}
        <div className="mt-2 flex items-center gap-2 px-3 py-2">
          <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="text-xs font-bold text-primary">
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{user.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop rail. Below md the same markup is rendered in the drawer instead — a permanently
          visible 224px rail leaves 151px of content on a 375px phone. */}
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-border bg-card md:flex">
        {sidebar}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* min-w-0 is load-bearing: without it a wide table makes this flex item grow past the
          viewport and scroll the whole document sideways instead of scrolling inside itself. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="flex size-9 items-center justify-center rounded-lg border border-border transition hover:bg-accent"
          >
            {drawerOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
              <FileSpreadsheet className="size-3.5 text-primary-foreground" />
            </div>
            <p className="truncate text-sm font-bold">GSTTool</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
