import { env } from "@/lib/env";
import { BLOG_POSTS_DATA } from "@/lib/seo/blog-data";
import { DOCS_DATA } from "@/lib/seo/docs-data";
import PAGE_DATES from "@/lib/seo/page-dates.generated.json";
import { PLATFORMS_SEO_DATA } from "@/lib/seo/platforms-data";

export type RouteGroup = "static" | "platform" | "doc" | "blog" | "private";

export interface RouteEntry {
  path: string;
  isPublic: boolean;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
  /** ISO 8601. Real content date — never the build time. */
  lastModified: string;
  group: RouteGroup;
}

const dates: Record<string, string | undefined> = PAGE_DATES;
const FALLBACK_DATE = "2025-01-01T00:00:00.000Z";

/**
 * Every route behind authentication. sitemap.ts must never emit these and robots.ts
 * must disallow all of them — both read this one list so they cannot drift apart.
 */
export const PRIVATE_ROUTE_PREFIXES = [
  "/dashboard",
  "/convert",
  "/history",
  "/profile",
  "/settings",
  "/billing",
  "/refer",
  "/support",
  "/admin",
  "/api",
] as const;

/**
 * Public but deliberately absent from the sitemap. These are conversion endpoints
 * whose entire content is a form — there is nothing for a crawler to rank, so listing
 * them only spends crawl budget. They stay allowed in robots.txt so Google can still
 * follow internal links to them without reporting a "blocked" error.
 */
const UNLISTED_PUBLIC_PATHS = ["/login", "/register"] as const;

/** Marketing pages, keyed to the generated git dates. Priority reflects commercial intent. */
const STATIC_ROUTES: ReadonlyArray<Omit<RouteEntry, "lastModified" | "isPublic" | "group">> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/features", changeFrequency: "monthly", priority: 0.9 },
  { path: "/platforms", changeFrequency: "weekly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.8 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.8 },
  { path: "/about", changeFrequency: "yearly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.6 },
  { path: "/security", changeFrequency: "yearly", priority: 0.5 },
  { path: "/changelog", changeFrequency: "weekly", priority: 0.4 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.3 },
  // Razorpay requires a published delivery policy even for digital goods.
  { path: "/shipping-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/disclaimer", changeFrequency: "yearly", priority: 0.3 },
];

/**
 * A dynamic URL's date is the later of its own content field and the commit that last
 * touched the shared data module — editing that module is a real change even when the
 * per-item field was not bumped.
 */
function contentDate(moduleKey: string, itemDate: string | undefined): string {
  const moduleDate = dates[moduleKey] ?? FALLBACK_DATE;
  if (!itemDate) return moduleDate;
  const parsed = new Date(itemDate);
  if (Number.isNaN(parsed.getTime())) return moduleDate;
  const iso = parsed.toISOString();
  return iso > moduleDate ? iso : moduleDate;
}

function buildRoutes(): RouteEntry[] {
  const staticRoutes: RouteEntry[] = STATIC_ROUTES.map((route) => ({
    ...route,
    isPublic: true,
    group: "static",
    lastModified: dates[route.path] ?? FALLBACK_DATE,
  }));

  const platformRoutes: RouteEntry[] = Object.values(PLATFORMS_SEO_DATA).map((item) => ({
    path: `/platforms/${item.slug}`,
    isPublic: true,
    group: "platform",
    changeFrequency: "monthly",
    priority: 0.9,
    lastModified: contentDate("@platforms-data", item.updatedAt),
  }));

  const docRoutes: RouteEntry[] = Object.values(DOCS_DATA).map((item) => ({
    path: `/docs/${item.slug}`,
    isPublic: true,
    group: "doc",
    changeFrequency: "monthly",
    priority: 0.7,
    lastModified: contentDate("@docs-data", item.updatedAt ?? item.publishedAt),
  }));

  const blogRoutes: RouteEntry[] = Object.values(BLOG_POSTS_DATA).map((item) => ({
    path: `/blog/${item.slug}`,
    isPublic: true,
    group: "blog",
    changeFrequency: "monthly",
    priority: 0.8,
    lastModified: contentDate("@blog-data", item.updatedAt ?? item.publishedDate),
  }));

  const privateRoutes: RouteEntry[] = PRIVATE_ROUTE_PREFIXES.map((path) => ({
    path,
    isPublic: false,
    group: "private",
    changeFrequency: "daily",
    priority: 0,
    lastModified: FALLBACK_DATE,
  }));

  return [...staticRoutes, ...platformRoutes, ...docRoutes, ...blogRoutes, ...privateRoutes];
}

export const ALL_ROUTES: ReadonlyArray<RouteEntry> = buildRoutes();

export function getPublicRoutes(): RouteEntry[] {
  return ALL_ROUTES.filter((route) => route.isPublic);
}

export function getPrivateRoutePrefixes(): string[] {
  return [...PRIVATE_ROUTE_PREFIXES];
}

/** Public paths intentionally kept out of the sitemap but allowed in robots.txt. */
export function getUnlistedPublicPaths(): string[] {
  return [...UNLISTED_PUBLIC_PATHS];
}

export function isPrivatePath(path: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Trailing slashes are stripped so a route's URL is byte-identical everywhere it is emitted. */
export function toAbsoluteUrl(path: string): string {
  const origin = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return path === "/" ? origin : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Every public URL, absolute. The unit the indexing notifier submits. */
export function getPublicUrls(): string[] {
  return getPublicRoutes().map((route) => toAbsoluteUrl(route.path));
}
