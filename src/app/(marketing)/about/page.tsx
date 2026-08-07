import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "About GSTPilot — E-Commerce GST Engine",
  description:
    "Learn about GSTPilot's mission to simplify e-commerce GST compliance for Indian sellers and CAs.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-16">
      <div className="space-y-4 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          About GSTPilot
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          Simplifying E-Commerce GST Compliance
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
          We built GSTPilot to eliminate the hours spent manually copy-pasting Excel reports from
          Amazon, Meesho, Flipkart, and D2C stores into government filings.
        </p>
      </div>

      <div className="space-y-6 rounded-3xl border border-border bg-card p-8 text-xs leading-relaxed text-muted-foreground shadow-sm sm:text-sm">
        <h2 className="text-xl font-bold text-foreground">Engineering First Principles</h2>
        <p>
          Unlike legacy ERP software that forces sellers into complex inventory accounting modules,
          GSTPilot is built with a single goal:{" "}
          <strong className="text-foreground">
            Convert marketplace Excel files into official GSTR-1 Excel and JSON files as fast as
            possible.
          </strong>
        </p>
        <p>
          Our pipeline engines automatically calculate Net Sales (Sales - Returns), normalize tax
          rates, auto-fix invalid GSTINs and state codes, and reconcile TCS data with Section 52
          requirements.
        </p>
      </div>
    </div>
  );
}
