"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isItemActive, type NavGroup } from "@/config/navigation";
import { AppHeader } from "@/components/app-header";
import { AppLogo } from "@/components/app-logo";
import { SITE } from "@/config/site";
import { createPersistedToggle } from "@/lib/persisted-toggle";

const sidebarCollapsed = createPersistedToggle("gstpilot.sidebar.collapsed");

interface AppShellProps {
  children: React.ReactNode;
  user: { name: string; email: string };
  isAdmin?: boolean;
  credits?: number | null;
}

export function AppShell({ children, user, isAdmin = false, credits }: AppShellProps) {
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
      {/* Sticky, full-height, and its own scroll container: the page scrolls
          under it rather than taking the nav with it. `h-dvh` keeps it exactly
          one viewport tall so a long nav scrolls internally instead of pushing
          the rail past the bottom of the screen. */}
      <aside
        className={cn(
          // overflow-hidden, not auto: SidebarContent's <nav> is the scroller,
          // which keeps the logo pinned and avoids a nested scrollbar.
          "sticky top-0 hidden h-dvh flex-shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar-background transition-[width] duration-300 ease-[var(--ease-standard)] lg:flex",
          collapsed ? "w-[68px]" : "w-64"
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
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col border-r border-sidebar-border bg-sidebar-background shadow-xl">
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="absolute top-4 right-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            {/* Closing on link click rather than on a pathname effect: tapping a
                link must not leave the overlay covering the page beneath it. */}
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
          credits={credits}
          collapsed={collapsed}
          onOpenMobileNav={() => setDrawerOpen(true)}
          onToggleCollapse={toggleCollapse}
        />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
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
    <>
      <div
        className={cn(
          "flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-4"
        )}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5 overflow-hidden"
          title={SITE.name}
        >
          {collapsed ? (
            <AppLogo size="sm" className="max-w-[40px] overflow-hidden" />
          ) : (
            <AppLogo size="md" priority />
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.id}>
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                {group.label}
              </p>
            )}
            {/* A hairline stands in for the group label when collapsed, so the
                rail keeps its grouping instead of becoming one long list. */}
            {collapsed && <div className="mx-2 mb-2 h-px bg-sidebar-border" aria-hidden />}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isItemActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors duration-200",
                        collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2",
                        active
                          ? "bg-primary/12 text-primary-ink"
                          : item.accent
                            ? "text-primary-ink hover:bg-primary/10"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {/* Active rail — the marker that survives a squint test. */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 h-5 w-0.5 rounded-r-full bg-primary transition-opacity duration-200",
                          active ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <item.icon
                        className={cn(
                          "size-4 flex-shrink-0 transition-transform",
                          !active && "group-hover:scale-110"
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
    </>
  );
}
