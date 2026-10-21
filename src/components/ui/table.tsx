import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Table primitives with a sticky header and horizontal scroll contained to the
 * wrapper. `min-w-0` on the scroll parent is what stops a wide table from
 * scrolling the whole document sideways.
 */
export function TableWrapper({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-blue-500/20 bg-card shadow-xs",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-[14px]", className)} {...props} />;
}

export function TableHeader({
  className,
  sticky = true,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) {
  return (
    <thead
      className={cn(
        "border-b border-blue-500/20 bg-gradient-to-r from-blue-900/[0.08] via-indigo-900/[0.05] to-blue-900/[0.08] text-xs font-bold tracking-wider text-blue-950 uppercase shadow-2xs backdrop-blur-xs dark:from-blue-950/70 dark:via-slate-900/60 dark:to-indigo-950/70 dark:text-blue-100",
        sticky && "sticky top-0 z-10",
        className
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border/70", className)} {...props} />;
}

export function TableRow({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-blue-500/[0.03] dark:hover:bg-blue-400/[0.06]",
        interactive && "cursor-pointer hover:bg-blue-500/[0.06] dark:hover:bg-blue-400/[0.09]",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-blue-500/20 px-4.5 py-3.5 text-xs font-bold tracking-wider text-blue-950 uppercase dark:text-blue-100",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  align = "left",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-4.5 py-3.5 text-[14px] leading-relaxed font-medium text-foreground/90",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      {...props}
    />
  );
}

/** Full-width row for the "no results" case, so the table keeps its chrome. */
export function TableEmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
