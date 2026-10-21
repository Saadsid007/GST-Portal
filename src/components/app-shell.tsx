"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isItemActive, type NavGroup } from "@/config/navigation";
import { AppHeader } from "@/components/app-header";
import { AppLogo } from "@/components/app-logo";
import { BRAND_NAME } from "@/config/brand";
import { createPersistedToggle } from "@/lib/persisted-toggle";
import { FeedbackWidget } from "@/components/feedback-widget";

const sidebarCollapsed = createPersistedToggle("gstpilot.sidebar.collapsed");

interface AppShellProps {
  children: React.ReactNode;
  user: { name: string; email: string };
  isAdmin?: boolean;
}

export function AppShell({ children, user, isAdmin = false }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const collapsed = useSyncExternalStore(
    sidebarCollapsed.subscribe,
    sidebarCollapsed.getSnapshot,
    sidebarCollapsed.getServerSnapshot
  );

  const toggleCollapse = useCallback(() => sidebarCollapsed.toggle(), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Escape closes the drawer, and body scroll is locked while it is open.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const groups = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      {/* Sticky, full-height, and its own scroll container */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh flex-shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar-background shadow-[1px_0_15px_-4px_rgba(0,0,0,0.03)] transition-[width] duration-300 ease-[var(--ease-standard)] lg:flex dark:shadow-[1px_0_25px_-4px_rgba(0,0,0,0.45)]",
          collapsed ? "w-[64px]" : "w-60"
        )}
      >
        <SidebarContent groups={groups} pathname={pathname} collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] animate-slide-in flex-col border-r border-sidebar-border bg-sidebar-background shadow-2xl">
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="absolute top-3.5 right-3 rounded-lg p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <X className="size-4" />
            </button>
            <SidebarContent
              groups={groups}
              pathname={pathname}
              collapsed={false}
              onNavigate={closeDrawer}
            />
          </aside>
        </div>
      )}

      {/* min-w-0 is load-bearing: without it a wide table grows this flex item
          past the viewport and scrolls the whole document sideways. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={user}
          isAdmin={isAdmin}
          collapsed={collapsed}
          onOpenMobileNav={() => setDrawerOpen(true)}
          onToggleCollapse={toggleCollapse}
        />
        <main className="min-w-0 flex-1 bg-background">
          <div className="mx-auto w-full max-w-6xl px-3.5 py-4 sm:px-5 sm:py-5">{children}</div>
        </main>
      </div>

      {/* Floating Sticky Customer Feedback Widget */}
      <FeedbackWidget user={user} />
    </div>
  );
}

function SidebarContent({
  groups,
  pathname,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Ambient top light glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 left-1/2 h-28 w-44 -translate-x-1/2 rounded-full bg-primary/20 blur-2xl"
      />

      {/* Header Logo area */}
      <div
        className={cn(
          "relative z-10 flex h-13 flex-shrink-0 items-center border-b border-white/[0.06] sm:h-14",
          collapsed ? "justify-center px-2" : "justify-between px-3.5"
        )}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 overflow-hidden"
          title={BRAND_NAME}
        >
          {collapsed ? (
            <AppLogo size="sm" forceDark className="max-w-[20px] overflow-hidden sm:max-w-[24px]" />
          ) : (
            <div className="flex items-center gap-2">
              <AppLogo size="sm" forceDark priority />
            </div>
          )}
        </Link>
        {!collapsed && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold tracking-tight text-sidebar-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            Portal
          </span>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="relative z-10 scrollbar-none flex-1 space-y-4 overflow-y-auto px-2.5 py-3.5">
        {groups.map((group) => (
          <div key={group.id}>
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[10.5px] font-bold tracking-wider text-sidebar-foreground/60 uppercase">
                {group.label}
              </p>
            )}
            {collapsed && <div className="mx-2 mb-2 h-px bg-white/[0.06]" aria-hidden />}

            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isItemActive(pathname, item.href);
                const isConvert = item.href === "/convert";

                // SPECIAL HIGHLIGHT FOR CONVERT MODULE WITH LIGHT SPEED FLASH ANIMATION (VIBRANT DEFAULT LOOK)
                if (isConvert) {
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label + " (Instant AI GSTR-1 Engine)" : undefined}
                        className={cn(
                          "group relative flex items-center overflow-hidden rounded-xl font-semibold transition-all duration-200 select-none",
                          collapsed
                            ? "mx-auto size-10 justify-center p-0"
                            : "gap-2.5 px-3 py-2.5 text-[13.5px]",
                          "bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shadow-md shadow-blue-950/50 hover:shadow-lg hover:shadow-blue-900/50 hover:brightness-110",
                          active && "shadow-lg shadow-blue-900/60 brightness-105"
                        )}
                      >
                        {/* LIGHT SPEED FLASH BEAM ANIMATION */}
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 -skew-x-20 overflow-hidden"
                        >
                          <div className="absolute inset-y-0 w-24 -translate-x-full animate-[lightspeed-flash_3.4s_cubic-bezier(0.2,0.8,0.2,1)_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:via-white/60" />
                        </div>

                        {/* Icon with lightning charge effect */}
                        <div
                          className={cn(
                            "relative flex flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                            collapsed
                              ? "size-6"
                              : "size-6 bg-white/20 text-white group-hover:bg-white/30"
                          )}
                        >
                          <item.icon
                            className="size-[17px] text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.75)] transition-transform duration-200 group-hover:scale-110 group-hover:text-amber-200"
                            aria-hidden
                          />
                        </div>

                        {!collapsed && (
                          <>
                            <span className="truncate font-semibold tracking-tight text-white">
                              {item.label}
                            </span>
                            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase shadow-xs transition-colors group-hover:bg-white/30">
                              <span className="size-1 animate-ping rounded-full bg-emerald-400" />
                              FAST
                            </span>
                          </>
                        )}
                      </Link>
                    </li>
                  );
                }

                // Standard Nav Items
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-150 select-none",
                        collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-2.5 py-2",
                        active
                          ? "bg-primary/20 font-semibold text-white shadow-xs"
                          : "text-sidebar-foreground hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 h-4.5 w-1 rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] transition-all duration-150",
                          active ? "scale-y-100 opacity-100" : "scale-y-50 opacity-0"
                        )}
                      />
                      <item.icon
                        className={cn(
                          "size-[18px] flex-shrink-0 transition-transform duration-150",
                          active
                            ? "text-primary"
                            : "text-sidebar-foreground/70 group-hover:scale-105 group-hover:text-sidebar-accent-foreground"
                        )}
                        aria-hidden
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer Status Indicator */}
      {!collapsed && (
        <div className="relative z-10 mt-auto border-t border-white/[0.06] p-2.5">
          <div className="relative overflow-hidden rounded-xl bg-white/[0.04] p-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[11px] font-semibold text-sidebar-foreground">
                  AI Pipeline Active
                </span>
              </div>
              <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-400">
                V2.2
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-tight text-sidebar-foreground/65">
              Marketplace returns verified &amp; ready
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
