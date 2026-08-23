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
      {/* Sticky, full-height, and its own scroll container: the page scrolls
          under it rather than taking the nav with it. `h-dvh` keeps it exactly
          one viewport tall so a long nav scrolls internally instead of pushing
          the rail past the bottom of the screen. */}
      <aside
        className={cn(
          // overflow-hidden, not auto: SidebarContent's <nav> is the scroller,
          // which keeps the logo pinned and avoids a nested scrollbar.
          "sticky top-0 hidden h-dvh flex-shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar-background transition-[width] duration-300 ease-[var(--ease-standard)] lg:flex",
          collapsed ? "w-[60px]" : "w-56"
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
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] animate-slide-in flex-col border-r border-sidebar-border bg-sidebar-background shadow-xl">
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="absolute top-3.5 right-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
          "flex h-13 flex-shrink-0 items-center gap-2 border-b border-sidebar-border sm:h-14",
          collapsed ? "justify-center px-2" : "px-3.5"
        )}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 overflow-hidden"
          title={SITE.name}
        >
          {collapsed ? (
            <AppLogo size="sm" className="max-w-[36px] overflow-hidden" />
          ) : (
            <AppLogo size="sm" priority />
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-3.5 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.id}>
            {!collapsed && (
              <p className="px-2 pb-1 text-[9px] font-bold tracking-wider text-muted-foreground/70 uppercase">
                {group.label}
              </p>
            )}
            {collapsed && <div className="mx-2 mb-1.5 h-px bg-sidebar-border" aria-hidden />}

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
                        "group relative flex items-center gap-2 rounded-lg text-xs font-medium transition-colors duration-150",
                        collapsed ? "justify-center px-2 py-2" : "px-2.5 py-1.5",
                        active
                          ? "bg-primary/12 font-semibold text-primary-ink"
                          : item.accent
                            ? "text-primary-ink hover:bg-primary/10"
                            : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 h-4 w-0.5 rounded-r-full bg-primary transition-opacity duration-150",
                          active ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <item.icon
                        className={cn(
                          "size-4 flex-shrink-0 transition-transform",
                          !active && "group-hover:scale-105"
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
