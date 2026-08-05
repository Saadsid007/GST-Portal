import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion, Home, LifeBuoy } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <p className="mb-4 text-center font-mono text-6xl font-bold tracking-tighter text-primary-ink">
          404
        </p>
        <EmptyState
          icon={FileQuestion}
          title="We couldn't find that page"
          description="The link may be out of date, or the page may have moved. The converter and your filing history are both still where you left them."
          action={
            <Button asChild variant="brand">
              <Link href="/">
                <Home />
                Go home
              </Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline">
              <Link href="/docs">
                <LifeBuoy />
                Browse the docs
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
