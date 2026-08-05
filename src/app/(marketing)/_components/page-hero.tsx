import * as React from "react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Shared hero for every non-landing marketing page, so About, Pricing, Security
 * and the legal pages all open the same way instead of each inventing a header.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  /** Actions or metadata rendered under the description. */
  children?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <section className={cn("relative px-6 pt-16 pb-4 md:pt-20", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 brand-glow"
      />
      <div
        className={cn(
          "mx-auto max-w-3xl space-y-4",
          align === "center" ? "text-center" : "text-left"
        )}
      >
        {eyebrow && (
          <Badge variant="primary" size="md">
            {eyebrow}
          </Badge>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">{title}</h1>
        {description && (
          <div className="text-base leading-relaxed text-muted-foreground">{description}</div>
        )}
        {children && <div className="pt-2">{children}</div>}
      </div>
    </section>
  );
}

/** Card-wrapped long-form body used by the legal and policy pages. */
export function ContentPanel({
  children,
  lastUpdated,
  className,
}: {
  children: React.ReactNode;
  lastUpdated?: string;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto max-w-3xl px-6 pb-20", className)}>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-9">
        {lastUpdated && (
          <p className="mb-6 border-b border-border pb-4 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            Last updated {lastUpdated}
          </p>
        )}
        <div className="prose-content">{children}</div>
      </div>
    </section>
  );
}
