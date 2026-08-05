"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * Sonner styled from the design tokens rather than its defaults, so toasts
 * match the app in both themes instead of appearing as foreign chrome.
 */
export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="top-right"
      richColors
      closeButton
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border-border !bg-popover !text-popover-foreground !shadow-lg !font-sans",
          title: "!text-sm !font-semibold",
          description: "!text-xs !text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-md !text-xs !font-semibold",
          cancelButton: "!bg-muted !text-muted-foreground !rounded-md !text-xs",
          closeButton: "!bg-card !border-border !text-muted-foreground hover:!text-foreground",
        },
      }}
    />
  );
}
