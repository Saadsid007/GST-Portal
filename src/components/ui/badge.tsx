import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      // Status badges use the -ink text step: the tinted 10% fill is far too
      // light to carry the solid colour as text.
      variant: {
        neutral: "border-border bg-muted text-muted-foreground",
        primary: "border-primary/20 bg-primary/10 text-primary-ink",
        success: "border-success/20 bg-success/10 text-success-ink",
        warning: "border-warning/20 bg-warning/10 text-warning-ink",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive-ink",
        info: "border-info/20 bg-info/10 text-info-ink",
        solid: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border-strong bg-transparent text-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-2xs",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Renders a leading status dot in the badge's own colour. */
  dot?: boolean;
}

export function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export { badgeVariants };
