"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const controlBase = [
  "w-full rounded-md border bg-card text-sm text-foreground",
  "placeholder:text-muted-foreground/70",
  "transition-[border-color,box-shadow] duration-200",
  "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
].join(" ");

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Leading adornment — an icon or short unit label. */
  prefixNode?: React.ReactNode;
  suffixNode?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, prefixNode, suffixNode, ...props },
  ref
) {
  const control = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        "h-9 px-3 py-2",
        invalid
          ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25"
          : "border-input",
        prefixNode && "pl-9",
        suffixNode && "pr-9",
        className
      )}
      {...props}
    />
  );

  if (!prefixNode && !suffixNode) return control;

  return (
    <div className="relative">
      {prefixNode && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground [&_svg]:size-4">
          {prefixNode}
        </span>
      )}
      {control}
      {suffixNode && (
        <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground [&_svg]:size-4">
          {suffixNode}
        </span>
      )}
    </div>
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        "min-h-20 px-3 py-2",
        invalid ? "border-destructive" : "border-input",
        className
      )}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        "h-9 cursor-pointer px-3 py-2",
        invalid ? "border-destructive" : "border-input",
        className
      )}
      {...props}
    />
  );
});

export interface FieldProps {
  label: string;
  htmlFor?: string;
  /** Rendered under the control; replaced by `error` when one is present. */
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label + control + one message slot. The hint and the error share a slot so
 * the field never grows a second line and shifts the form on validation.
 */
export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-xs font-semibold text-foreground"
      >
        {label}
        {required && (
          <span className="text-destructive-ink" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p
          className="flex items-center gap-1.5 text-xs font-medium text-destructive-ink"
          role="alert"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
