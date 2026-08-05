import type { Metadata } from "next";
import Link from "next/link";
import { Zap, CheckCircle, FileSpreadsheet, ArrowRight, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "GSTPilot — Convert Amazon, Meesho & Flipkart Reports to GSTR-1 Excel & JSON",
  description:
    "Convert marketplace Excel reports to government-compatible GSTR-1 JSON & Excel files in seconds. Net sales calculation, auto column mapping & TCS reconciliation.",
  openGraph: {
    title: "GSTPilot — Marketplace to GSTR-1 Excel & JSON Converter",
    description:
      "Convert Amazon, Meesho & Flipkart Excel reports to official GSTR-1 JSON & Excel files.",
  },
};

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "GSTPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    description:
      "Marketplace Excel to GSTR-1 JSON & Multi-Sheet Excel Converter for Amazon, Meesho, Flipkart, and D2C brands.",
  };

  return (
    <div className="space-y-24 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl space-y-8 overflow-hidden px-6 pt-16 text-center md:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-sm">
          <Sparkles className="size-3.5" />
          <span>The #1 GSTTool.in Alternative for Modern E-Commerce Sellers</span>
        </div>

        <h1 className="mx-auto max-w-4xl text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-6xl">
          Convert Marketplace Reports to{" "}
          <span className="bg-gradient-to-r from-primary via-violet-600 to-indigo-600 bg-clip-text text-transparent">
            GSTR-1 Excel & JSON
          </span>{" "}
          in Seconds
        </h1>

        <p className="mx-auto max-w-2xl text-base leading-relaxed font-normal text-muted-foreground sm:text-lg">
          Stop struggling with complex ERPs and manual Excel formatting. Combine reports from{" "}
          <strong className="font-semibold text-foreground">
            Amazon, Meesho, Flipkart, Myntra & Custom files
          </strong>{" "}
          into 1 government-compatible filing.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
          <Link
            href="/convert"
            className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 sm:w-auto"
          >
            <Zap className="size-4" />
            <span>Start Free Conversion</span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/docs/getting-started"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-3.5 text-sm font-bold transition hover:bg-accent sm:w-auto"
          >
            <span>View Documentation</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="size-4 text-emerald-500" /> GSTN v3.0+ Compliant
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="size-4 text-emerald-500" /> Net Sales Calculation (Sales -
            Returns)
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="size-4 text-emerald-500" /> 1-Click Auto-Fixers
          </span>
        </div>

        {/* App Preview Card */}
        <div className="mx-auto max-w-5xl pt-10">
          <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-2xl ring-1 shadow-primary/10 ring-border sm:p-6">
            <div className="space-y-6 rounded-2xl border border-border/60 bg-muted/40 p-6 text-left sm:p-8">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
                    <FileSpreadsheet className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-bold">Net Sales Engine Output</p>
                    <p className="text-xs text-muted-foreground">
                      Amazon MTR + Meesho Sales & Returns Merged
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                  ✓ 100% Validated
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Gross Sales
                  </p>
                  <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    ₹4,85,200.00
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Sales Returns
                  </p>
                  <p className="mt-1 text-xl font-bold text-rose-500">- ₹42,150.00</p>
                </div>
                <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
                  <p className="text-xs font-semibold text-primary uppercase">Net Sales Taxable</p>
                  <p className="mt-1 text-2xl font-bold text-primary">₹4,43,050.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem vs Solution */}
      <section className="mx-auto max-w-7xl space-y-12 px-6">
        <div className="mx-auto max-w-2xl space-y-2 text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            Why Traditional GST Tools Fail E-Commerce Sellers
          </h2>
          <p className="text-sm text-muted-foreground">
            Every marketplace exports different headers and formats. GSTPilot standardizes
            everything into one pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Problem */}
          <div className="space-y-4 rounded-3xl border border-destructive/30 bg-destructive/5 p-8">
            <h3 className="text-lg font-bold text-destructive">
              The Old Way (Manual & Complex ERPs)
            </h3>
            <ul className="space-y-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-bold text-destructive">✗</span> Hours spent manually
                formatting Amazon, Meesho, and Flipkart Excel files.
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-destructive">✗</span> Overpaying tax on returned
                goods by failing to deduct sales returns.
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-destructive">✗</span> Mismatched state codes causing
                GST notices.
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-destructive">✗</span> Complex ERP software requiring
                expensive monthly subscriptions.
              </li>
            </ul>
          </div>

          {/* Solution */}
          <div className="space-y-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-8">
            <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              The GSTPilot Way
            </h3>
            <ul className="space-y-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="size-4 flex-shrink-0 text-emerald-500" /> Drag-and-drop
                report files for Amazon, Meesho, Flipkart, etc.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="size-4 flex-shrink-0 text-emerald-500" /> Net Sales Engine
                automatically computes Sales − Returns.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="size-4 flex-shrink-0 text-emerald-500" /> 1-click
                Auto-Fixers sanitize GSTINs, state codes, and HSN codes.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="size-4 flex-shrink-0 text-emerald-500" /> Instant official
                GSTN v3.0 JSON and multi-sheet Excel exports.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Supported Marketplaces */}
      <section className="mx-auto max-w-7xl space-y-12 px-6">
        <div className="mx-auto max-w-2xl space-y-2 text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Supported E-Commerce Marketplaces</h2>
          <p className="text-sm text-muted-foreground">
            GSTPilot includes dedicated strategy parsers for every major seller portal.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { name: "Amazon MTR", slug: "amazon-gst-report-generator", badge: "v3 Supported" },
            { name: "Meesho Panel", slug: "meesho-gst-report-generator", badge: "Sales + Returns" },
            { name: "Flipkart Hub", slug: "flipkart-gst-report-generator", badge: "Seller Export" },
            { name: "Myntra Partner", slug: "myntra-gst-report-generator", badge: "Tax Invoices" },
            {
              name: "JioMart Partner",
              slug: "jiomart-gst-report-generator",
              badge: "Orders Export",
            },
            { name: "Shopdeck D2C", slug: "shopdeck-gst-report-generator", badge: "D2C Stores" },
            { name: "GlowRoad", slug: "glowroad-gst-report-generator", badge: "Reseller Sales" },
            { name: "Snapdeal", slug: "snapdeal-gst-report-generator", badge: "Seller Orders" },
            { name: "Roposo Clout", slug: "custom-excel-gst-generator", badge: "Clout Reports" },
            { name: "Custom Excel", slug: "custom-excel-gst-generator", badge: "Universal Mapper" },
          ].map((m) => (
            <Link
              key={m.name}
              href={`/platforms/${m.slug}`}
              className="group space-y-2 rounded-2xl border border-border bg-card p-5 text-center shadow-sm transition hover:border-primary/50 hover:bg-accent/40"
            >
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <FileSpreadsheet className="size-5" />
              </div>
              <p className="text-sm font-bold text-foreground">{m.name}</p>
              <span className="inline-block rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {m.badge}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mx-auto max-w-5xl space-y-8 px-6">
        <div className="mx-auto max-w-2xl space-y-2 text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Manual Filing vs. GSTPilot</h2>
          <p className="text-sm text-muted-foreground">
            Compare the speed and accuracy of automated GST filing.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left font-bold text-muted-foreground">
                <th className="px-5 py-4">Feature</th>
                <th className="px-5 py-4 text-center">Manual Excel Filing</th>
                <th className="px-5 py-4 text-center font-bold text-primary">GSTPilot Engine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-5 py-3 font-semibold">Processing Speed</td>
                <td className="px-5 py-3 text-center text-muted-foreground">
                  2 to 4 hours per month
                </td>
                <td className="px-5 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                  Less than 5 seconds
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold">Multi-Marketplace Combination</td>
                <td className="px-5 py-3 text-center text-muted-foreground">Manual Copy-Paste</td>
                <td className="px-5 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                  1-Click Merge Engine
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold">Net Sales Calculation (Sales - Returns)</td>
                <td className="px-5 py-3 text-center text-muted-foreground">
                  Error-prone manual formulas
                </td>
                <td className="px-5 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                  Automated Net Sales Engine
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold">TCS Section 52 Reconciliation</td>
                <td className="px-5 py-3 text-center text-muted-foreground">Not Available</td>
                <td className="px-5 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                  State-wise TCS Module
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="space-y-6 rounded-3xl border border-border bg-gradient-to-r from-primary via-violet-600 to-indigo-600 p-10 text-center text-white shadow-2xl shadow-primary/20 md:p-14">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to File Error-Free GSTR-1 Returns?
          </h2>
          <p className="mx-auto max-w-xl text-sm opacity-90 sm:text-base">
            Join e-commerce sellers and CAs using GSTPilot to convert marketplace reports into
            GSTR-1 files.
          </p>
          <Link
            href="/convert"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-sm font-extrabold text-slate-900 shadow-lg transition hover:bg-slate-100"
          >
            <Zap className="size-4 text-primary" />
            <span>Start Conversion Now</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
