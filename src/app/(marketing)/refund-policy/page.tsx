import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy | GSTPilot",
  description: "30-day money back guarantee and refund policy.",
};

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <h1 className="text-3xl font-extrabold">Refund Policy</h1>
      <div className="space-y-4 rounded-3xl border border-border bg-card p-8 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        <p>We offer a hassle-free 30-day money-back guarantee for all paid subscription plans.</p>
      </div>
    </div>
  );
}
