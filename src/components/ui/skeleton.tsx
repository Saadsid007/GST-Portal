import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shimmer placeholder. Always give it a concrete height/width via className —
 * a zero-size skeleton is worse than no skeleton, because the layout still
 * jumps when the real content lands.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}

/** Multi-line text placeholder; the last line is short, the way real text ends. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Table placeholder that matches the real table's row rhythm. */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex gap-4 border-b border-border bg-subtle px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-3.5 flex-1", c === 0 && "max-w-[35%]")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-card p-5", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
