import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Primary action. Pass a Button (or a Button asChild wrapping a Link). */
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  /** `error` swaps the icon treatment to destructive without changing layout. */
  tone?: "default" | "error";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  tone = "default",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong px-6 py-14 text-center",
        className
      )}
    >
      <div
        className={cn(
          "mb-4 flex size-12 items-center justify-center rounded-xl ring-1",
          tone === "error"
            ? "bg-destructive/10 text-destructive-ink ring-destructive/20"
            : "bg-primary/10 text-primary-ink ring-primary/20"
        )}
      >
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
