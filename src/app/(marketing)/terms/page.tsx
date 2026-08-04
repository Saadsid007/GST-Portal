import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | GSTPilot",
  description: "Terms and conditions governing the use of GSTPilot platform.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <h1 className="text-3xl font-extrabold">Terms of Service</h1>
      <div className="space-y-4 rounded-3xl border border-border bg-card p-8 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        <p>Last updated: July 2025</p>
        <p>By using GSTPilot, you agree to comply with and be bound by these Terms of Service.</p>
        <h2 className="pt-2 text-base font-bold text-foreground">1. Use of Services</h2>
        <p>
          GSTPilot provides automated file conversion for marketplace tax reports. Users are
          responsible for verifying generated GSTR-1 JSON files before final submission to the
          Government GST Portal.
        </p>
      </div>
    </div>
  );
}
