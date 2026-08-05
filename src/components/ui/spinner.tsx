import * as React from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-9 border-[3px]",
} as const;

/**
 * Ring spinner. A bordered ring rather than a spinning icon so it reads at any
 * size and inherits the accent colour without an SVG round-trip.
 */
export function Spinner({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: keyof typeof SIZES;
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <span
        className={cn(
          "animate-spin rounded-full border-current border-r-transparent text-primary",
          SIZES[size],
          className
        )}
      />
    </span>
  );
}

/** Blurred scrim for in-place refreshes that must not lose scroll position. */
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-background/70 backdrop-blur-sm">
      <Spinner size="lg" />
      {message && <p className="text-sm font-medium text-muted-foreground">{message}</p>}
    </div>
  );
}
