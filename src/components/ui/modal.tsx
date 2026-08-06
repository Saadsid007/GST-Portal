"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-4xl",
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Small icon rendered before the title. */
  icon?: React.ReactNode;
  description?: React.ReactNode;
  size?: keyof typeof SIZES;
  /** Pinned below the scroll area; never scrolls away. */
  footer?: React.ReactNode;
  /** Hides the default close button when the flow controls dismissal itself. */
  hideClose?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The one modal shell.
 *
 * Height is the thing every hand-rolled dialog here got wrong: with no cap, a
 * tall body runs off the viewport and the actions become unreachable. This caps
 * the panel at the viewport and scrolls the *body* only, so the header and
 * footer stay put.
 *
 * `dvh` rather than `vh` — on mobile browsers `vh` measures the viewport with
 * the URL bar hidden, so a `90vh` panel is taller than the screen until you
 * scroll. The outer wrapper also scrolls, so a panel taller than a very short
 * window (landscape phone) is still reachable rather than clipped.
 */
export function Modal({
  open,
  onClose,
  title,
  icon,
  description,
  size = "md",
  footer,
  hideClose = false,
  className,
  children,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { body } = document;
    // Compensate for the scrollbar the lock removes, or the page shifts.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      // Focus trap: without it, tabbing walks into the page behind the overlay.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* min-h-full + items-center centres on tall screens but lets the panel
          scroll from the top once it outgrows the window. */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex max-h-[calc(100dvh-2rem)] w-full animate-scale-in flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-xl",
            SIZES[size],
            className
          )}
        >
          {(title || !hideClose) && (
            <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                {title && (
                  <p id={titleId} className="flex items-center gap-2 text-sm font-semibold">
                    {icon}
                    {title}
                  </p>
                )}
                {description && (
                  <p id={descId} className="mt-0.5 text-xs text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              {!hideClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-1.5 flex-shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

          {footer && (
            <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-border bg-subtle px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
