"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

/**
 * Root error boundary. Renders inside the root layout, so the user keeps the
 * page chrome and theme instead of dropping to Next.js's unstyled default.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The pino logger is server-only, so a client boundary can't use it. Next
    // already logs the underlying error server-side and gives us the digest to
    // correlate against; re-logging here would only duplicate it in devtools.
    void error.digest;
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <EmptyState
          tone="error"
          icon={AlertTriangle}
          title="Something went wrong"
          description="This one is on us, not you. The error has been logged — retry the page, and if it keeps happening head back to the dashboard."
          action={
            <Button onClick={reset} variant="primary">
              <RotateCcw />
              Try again
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <Home />
                Back to dashboard
              </Link>
            </Button>
          }
        />
        {error.digest && (
          <p className="mt-4 text-center font-mono text-2xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
