import type { Metadata } from "next";
import { Lock, Server } from "lucide-react";

export const metadata: Metadata = {
  title: "Security Model & Infrastructure | GSTPilot",
  description:
    "Learn about GSTPilot's enterprise-grade security, TLS 1.3 encryption, and data protection policies.",
};

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-16">
      <div className="space-y-4 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Security Model
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Enterprise Data Security
        </h1>
        <p className="text-sm text-muted-foreground">
          Your tax and financial data is protected with 256-bit encryption.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-3xl border border-border bg-card p-6">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink">
            <Lock className="size-5" />
          </div>
          <h2 className="text-base font-bold">256-Bit SSL/TLS Encryption</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            All file uploads and API requests pass through encrypted HTTPS channels using modern TLS
            1.3 encryption protocols.
          </p>
        </div>

        <div className="space-y-3 rounded-3xl border border-border bg-card p-6">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink">
            <Server className="size-5" />
          </div>
          <h2 className="text-base font-bold">Isolated Session Processing</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Uploaded Excel files are processed in isolated worker sessions and are never sold or
            shared with third parties.
          </p>
        </div>
      </div>
    </div>
  );
}
