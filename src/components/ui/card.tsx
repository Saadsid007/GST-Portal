import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-xl border text-card-foreground", {
  variants: {
    variant: {
      /** Default resting surface. */
      solid: "border-border bg-card shadow-sm",
      /** Sits directly on the canvas with no fill — for grouping, not emphasis. */
      ghost: "border-border/70 bg-transparent",
      /** Nested inside another card. */
      subtle: "border-border/70 bg-subtle",
      /** Accent-tinted, for the one card on a page that matters most. */
      accent: "border-primary/25 bg-primary/[0.06] shadow-sm",
      /** Dashed outline for empty slots and drop targets. */
      dashed: "border-dashed border-border-strong bg-transparent",
    },
    interactive: {
      true: "card-lift cursor-pointer hover:border-primary/40",
      false: "",
    },
  },
  defaultVariants: { variant: "solid", interactive: false },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant, interactive, ...props },
  ref
) {
  return (
    <div ref={ref} className={cn(cardVariants({ variant, interactive }), className)} {...props} />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex flex-col gap-1 p-5", className)} {...props} />;
  }
);

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...props }, ref) {
  return (
    <h3 ref={ref} className={cn("text-base leading-none font-semibold", className)} {...props} />
  );
});

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />;
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />;
  }
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-3 border-t border-border p-5", className)}
        {...props}
      />
    );
  }
);
