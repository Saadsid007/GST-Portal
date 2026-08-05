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
        "relative w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function TableHeader({
  className,
  sticky = true,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) {
  return (
    <thead
      className={cn(
        "bg-subtle text-2xs font-semibold tracking-wide text-muted-foreground uppercase",
        sticky && "sticky top-0 z-10",
        className
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableRow({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        "transition-colors",
        interactive && "cursor-pointer hover:bg-accent/50",
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
        "border-b border-border px-4 py-2.5 font-semibold",
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
        "px-4 py-3",
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
