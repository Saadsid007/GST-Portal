import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui";

/**
 * Shown instantly on navigation into any dashboard route while the server
 * component tree resolves. Without this file Next.js holds the old page on
 * screen for the full duration of the server render, which is what made
 * switching pages feel like a 1–2s stall.
 *
 * The shape deliberately mirrors the real dashboard so the swap is a fill-in,
 * not a re-layout.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-6 md:p-8">
        <Skeleton className="h-5 w-48 rounded-full" />
        <Skeleton className="h-7 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-4 w-56" />
        <SkeletonTable rows={5} cols={6} />
      </div>
    </div>
  );
}
