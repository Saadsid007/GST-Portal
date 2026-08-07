import type { Metadata } from "next";
import { Sparkles, CheckCircle } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Changelog & Product Updates",
  description:
    "Recent updates, engine improvements, and new marketplace parser releases in GSTPilot.",
  path: "/changelog",
});

export default function ChangelogPage() {
  const updates = [
    {
      version: "v2.5.0",
      date: "July 2025",
      title: "Amazon MTR v3.0, TCS Reconciliation Module & 10-Step Wizard",
      items: [
        "Full support for Amazon Merchant Tax Report v3 layout",
        "Dedicated Section 52 TCS Reconciliation Module against GST Portal exports",
        "Smart Error Resolution Center with 1-click Auto-Fixers",
        "Universal Mapping Engine with saved database profiles",
        "10-Step Guided Flow UI",
      ],
    },
    {
      version: "v2.0.0",
      date: "May 2025",
      title: "Multi-Marketplace Pipeline Engine",
      items: [
        "Combine reports from Amazon, Meesho, Flipkart, and Myntra simultaneously",
        "Net Sales Engine (Gross Sales - Sales Returns = Net Sales)",
        "Official GSTN v3.0 JSON and multi-sheet Excel generator",
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-16">
      <div className="space-y-4 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Product Changelog
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Recent Product Updates
        </h1>
        <p className="text-sm text-muted-foreground">
          Stay up to date with new platform parsers, features, and compliance updates.
        </p>
      </div>

      <div className="space-y-8">
        {updates.map((up) => (
          <div
            key={up.version}
            className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary-ink" />
                <span className="text-base font-bold">{up.title}</span>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary-ink">
                {up.version} • {up.date}
              </span>
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {up.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 size-3.5 flex-shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
