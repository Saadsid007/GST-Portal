"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[var(--ease-standard)]",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Pointer events off while disabled so a disabled submit can't swallow clicks.
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.985]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
        brand: "brand-gradient text-primary-foreground shadow-accent hover:brightness-[1.07]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-border-strong bg-card text-foreground shadow-xs hover:border-primary/40 hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "text-primary-ink underline-offset-4 hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md",
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90 hover:shadow-md",
      },
      size: {
        xs: "h-7 rounded-sm px-2.5 text-2xs [&_svg]:size-3.5",
        sm: "h-8 rounded-sm px-3 text-xs [&_svg]:size-3.5",
        md: "h-9 rounded-md px-4 text-sm [&_svg]:size-4",
        lg: "h-11 rounded-lg px-6 text-base [&_svg]:size-4",
        xl: "h-12 rounded-xl px-8 text-base [&_svg]:size-[1.125rem]",
        icon: "size-9 rounded-md [&_svg]:size-4",
        "icon-sm": "size-8 rounded-sm [&_svg]:size-3.5",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Shown in place of children while `loading`. Falls back to the children. */
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    block,
    asChild = false,
    loading = false,
    loadingText,
    disabled,
    children,
    ...props
  },
  ref
) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
});

export { buttonVariants };
