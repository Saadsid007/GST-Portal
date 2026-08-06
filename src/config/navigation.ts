import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  History,
  Settings,
  Zap,
  Wallet,
  Users,
  Tags,
  Ticket,
  Megaphone,
  ShieldCheck,
  Coins,
  Gift,
  LifeBuoy,
  Inbox,
  BookOpen,
  Megaphone as MegaphoneIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Short line used by the header subtitle and the collapsed-rail tooltip. */
  description?: string;
  /** Renders the item with accent treatment — reserved for the primary action. */
  accent?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  /** Hidden entirely unless the signed-in user is an admin. */
  adminOnly?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Your filing activity at a glance",
      },
      {
        label: "Convert",
        href: "/convert",
        icon: Zap,
        description: "Turn marketplace reports into GSTR-1",
        accent: true,
      },
      {
        label: "GST Profile",
        href: "/profile",
        icon: Building2,
        description: "GSTINs you file for",
      },
      {
        label: "History",
        href: "/history",
        icon: History,
        description: "Previously generated returns",
      },
      {
        label: "Wallet",
        href: "/billing",
        icon: Wallet,
        description: "Credits, recharges and referrals",
      },
      {
        label: "Refer & earn",
        href: "/refer",
        icon: Gift,
        description: "Free credits for you and whoever you invite",
      },
      {
        label: "Support",
        href: "/support",
        icon: LifeBuoy,
        description: "Raise an issue and track it to resolution",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Account preferences",
      },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    adminOnly: true,
    items: [
      {
        label: "Overview",
        href: "/admin",
        icon: ShieldCheck,
        description: "Platform health and key numbers",
      },
      {
        label: "Users",
        href: "/admin/users",
        icon: Users,
        description: "Accounts, roles and access",
      },
      {
        label: "Pricing",
        href: "/admin/pricing",
        icon: Tags,
        description: "Generation cost, bonus slabs and recharge packs",
      },
      {
        label: "Wallets",
        href: "/admin/wallets",
        icon: Coins,
        description: "Adjust balances and inspect ledgers",
      },
      {
        label: "Credit codes",
        href: "/admin/credit-codes",
        icon: Ticket,
        description: "Issue and revoke promotional codes",
      },
      {
        label: "Support inbox",
        href: "/admin/support",
        icon: Inbox,
        description: "Contact messages and user support requests",
      },
      {
        label: "Blog Posts",
        href: "/admin/blog",
        icon: BookOpen,
        description: "Publish compliance guides, tutorials and SEO articles",
      },
      {
        label: "Announcements",
        href: "/admin/announcements",
        icon: MegaphoneIcon,
        description: "The scrolling offer strip on the public site",
      },
      {
        label: "Campaigns",
        href: "/admin/campaigns",
        icon: Megaphone,
        description: "Seasonal bonuses, referrals and the free trial",
      },
    ],
  },
];

/** Flattened lookup used by the header for breadcrumbs and the page subtitle. */
export const NAV_INDEX: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Longest-prefix match, so `/admin/credit-codes` resolves to Credit codes
 * rather than the shorter `/admin` Overview entry.
 */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_INDEX.filter(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  ).sort((a, b) => b.href.length - a.href.length)[0];
}

export function isItemActive(pathname: string, href: string): boolean {
  const match = findNavItem(pathname);
  return match?.href === href;
}
