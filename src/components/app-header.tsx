"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeft,
  Search,
  Settings,
  Sun,
  User,
  Wallet,
  X,
  ShieldCheck,
  Gift,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { NAV_GROUPS, findNavItem } from "@/config/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface Props {
  user: { name: string; email: string };
  isAdmin: boolean;
  onOpenMobileNav: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
  /** Wallet credits, shown as a live chip. Hidden when not yet known. */
  credits?: number | null;
}

export function AppHeader({
  user,
  isAdmin,
  onOpenMobileNav,
  onToggleCollapse,
  collapsed,
  credits,
}: Props) {
  const pathname = usePathname();
  const current = findNavItem(pathname);
  const group = NAV_GROUPS.find((g) => g.items.some((i) => i.href === current?.href));

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      {/* Mobile drawer trigger */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      {/* Desktop collapse toggle */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="hidden lg:inline-flex"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeft /> : <PanelLeftClose />}
      </Button>

      {/* Breadcrumb + title. Truncates rather than pushing the actions off-screen. */}
      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-2xs sm:flex">
          {group && (
            <>
              <span className="font-medium text-muted-foreground">{group.label}</span>
              <ChevronRight className="size-3 text-muted-foreground/50" aria-hidden />
            </>
          )}
          <span className="font-semibold text-foreground">{current?.label ?? "GSTPilot"}</span>
        </nav>
        <p className="truncate text-sm font-semibold sm:hidden">{current?.label ?? "GSTPilot"}</p>
        <p className="hidden truncate text-2xs text-muted-foreground sm:block">
          {current?.description}
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5">
        <GlobalSearch isAdmin={isAdmin} />

        {typeof credits === "number" && (
          <Link
            href="/billing"
            className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-2xs font-semibold transition-colors hover:border-primary/40 sm:inline-flex"
            title="Wallet balance"
          >
            <Wallet className="size-3.5 text-primary-ink" aria-hidden />
            <span className="tabular-nums">{credits.toLocaleString("en-IN")}</span>
            <span className="text-muted-foreground">credits</span>
          </Link>
        )}

        {/* Rewards are a growth surface, so they get a permanent home in the
            chrome rather than living inside the wallet page. */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="hidden lg:inline-flex"
          title="Refer & earn free credits"
        >
          <Link href="/refer">
            <Gift />
            Refer &amp; earn
          </Link>
        </Button>

        <NotificationsMenu credits={credits} />
        <ThemeToggle />
        <UserMenu user={user} isAdmin={isAdmin} />
      </div>
    </header>
  );
}

function GlobalSearch({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  const items = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin)
    .flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))
    .filter((i) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        i.label.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
      );
    });

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  // Global shortcut. Registered once; the palette owns its own keys while open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-index="' + cursor + '"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (items.length === 0 ? 0 : (c + 1) % items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (items.length === 0 ? 0 : (c - 1 + items.length) % items.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = items[cursor];
      if (target) go(target.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-2xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:inline-flex"
      >
        <Search className="size-3.5" aria-hidden />
        <span>Search</span>
        <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          &#8984;K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-foreground/30 backdrop-blur-sm"
          onClick={close}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search navigation"
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[min(32rem,calc(100dvh-4rem))] w-full max-w-xl animate-scale-in flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-xl"
            >
              <div className="flex flex-shrink-0 items-center gap-2 border-b border-border px-4">
                <Search className="size-4 flex-shrink-0 text-muted-foreground" aria-hidden />
                {/* A command palette that does not focus its input on open is
                    broken by definition. */}
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCursor(0);
                  }}
                  onKeyDown={onInputKeyDown}
                  placeholder="Jump to&#8230;"
                  aria-label="Search navigation"
                  className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                {items.length === 0 && (
                  <li className="px-3 py-8 text-center text-xs text-muted-foreground">
                    Nothing matches &ldquo;{query}&rdquo;
                  </li>
                )}
                {items.map((item, i) => (
                  <li key={item.href}>
                    <button
                      type="button"
                      data-index={i}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(item.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        i === cursor ? "bg-accent" : "hover:bg-accent/60"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-4 flex-shrink-0",
                          i === cursor ? "text-primary-ink" : "text-muted-foreground"
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        {item.description && (
                          <span className="block truncate text-2xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </span>
                      <span className="flex-shrink-0 text-2xs text-muted-foreground">
                        {item.group}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Doubles as the affordance that the list scrolls. */}
              <div className="flex flex-shrink-0 items-center gap-3 border-t border-border bg-subtle px-4 py-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Kbd>&#8593;</Kbd>
                  <Kbd>&#8595;</Kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>&#8629;</Kbd> open
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>esc</Kbd> close
                </span>
                <span className="ml-auto tabular-nums">
                  {items.length} result{items.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px] leading-none">
      {children}
    </kbd>
  );
}

function NotificationsMenu({ credits }: { credits?: number | null }) {
  // Derived, not fetched: a low balance is the one thing that actually blocks
  // the user mid-task, so it is worth surfacing here.
  const lowBalance = typeof credits === "number" && credits < 12;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell />
          {lowBalance && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-72 animate-scale-in rounded-xl border border-border bg-popover p-2 shadow-lg"
        >
          <p className="px-2 py-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
            Notifications
          </p>
          {lowBalance ? (
            <Link
              href="/billing"
              className="flex gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-accent"
            >
              <Wallet className="mt-0.5 size-4 flex-shrink-0 text-primary-ink" aria-hidden />
              <span>
                <span className="block text-xs font-semibold">Wallet running low</span>
                <span className="block text-2xs text-muted-foreground">
                  {credits} credits left — not enough for another return. Top up to keep filing.
                </span>
              </span>
            </Link>
          ) : (
            <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
              You&rsquo;re all caught up.
            </p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ThemeToggle() {
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
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}

function UserMenu({ user, isAdmin }: { user: { name: string; email: string }; isAdmin: boolean }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  const initial = user.name?.[0]?.toUpperCase() ?? "U";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-accent"
          aria-label="Account menu"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-2xs font-bold text-primary-ink ring-1 ring-primary/25">
            {initial}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-60 animate-scale-in rounded-xl border border-border bg-popover p-1.5 shadow-lg"
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary-ink ring-1 ring-primary/25">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{user.name}</p>
              <p className="truncate text-2xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {isAdmin && (
            <div className="px-2 pb-2">
              <Badge variant="primary" size="sm">
                <ShieldCheck className="size-3" aria-hidden />
                Administrator
              </Badge>
            </div>
          )}

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <MenuLink href="/profile" icon={User} label="GST profile" />
          <MenuLink href="/billing" icon={Wallet} label="Wallet & billing" />
          <MenuLink href="/settings" icon={Settings} label="Settings" />

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item
            onSelect={() => void signOut()}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive-ink transition-colors outline-none select-none hover:bg-destructive/10 focus:bg-destructive/10"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuLink({ href, icon: Icon, label }: { href: string; icon: typeof User; label: string }) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className={cn(
          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors outline-none select-none",
          "hover:bg-accent focus:bg-accent"
        )}
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {label}
      </Link>
    </DropdownMenu.Item>
  );
}
