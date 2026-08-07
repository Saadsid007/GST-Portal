import type { Metadata } from "next";
import Link from "next/link";
import {
  Zap,
  Layers,
  Wand2,
  ShieldCheck,
  Scale,
  FileJson,
  Sparkles,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Features Directory — Multi-Marketplace GSTR-1 Engine",
  description:
    "Explore all features of GSTPilot: Multi-marketplace upload, auto platform detection, transformation engine, validation rules, TCS reconciliation, and GSTR-1 JSON export.",
  path: "/features",
});

export default function FeaturesPage() {
  const features = [
    {
      title: "Multi-Marketplace Pipeline Engine",
      description:
        "Upload and process sales reports from Amazon, Flipkart, Meesho, Myntra, and Custom Excel files simultaneously for the same filing period.",
      icon: Layers,
    },
    {
      title: "Auto Platform & Report Type Detector",
      description:
        "Automatically detects marketplace platform IDs, report slots, parser versions, and confidence scores from raw file headers and sheet names.",
      icon: Sparkles,
    },
    {
      title: "Universal Mapping Engine",
      description:
        "Fuzzy keyword matching algorithm automatically maps raw headers to standard GSTR-1 fields. Save custom mapping profiles to your account.",
      icon: Wand2,
    },
    {
      title: "Transformation Engine",
      description:
        "Pure value normalizers sanitize raw values (Dates, Numbers, GSTIN, State Codes, HSN) before any business rules are evaluated.",
      icon: RefreshCw,
    },
    {
      title: "Net Sales Engine (Sales - Returns)",
      description:
        "Automatically computes Net Sales = Gross Sales - Sales Returns, classifying returns into CDNR (Credit Notes) or B2CS adjustments.",
      icon: TrendingUp,
    },
    {
      title: "Smart Error Resolution Center",
      description:
        "Edit row errors inline directly in the table and use 1-click Auto-Fixers to sanitize GSTINs, state codes, and HSN codes.",
      icon: ShieldCheck,
    },
    {
      title: "TCS Reconciliation Module",
      description:
        "Compare state-wise GSTR-1 net sales against official GST Portal TCS Excel exports under Section 52 of the GST Act.",
      icon: Scale,
    },
    {
      title: "Official GSTR-1 JSON & Excel Exports",
      description:
        "Download GSTN v3.0 compliant JSON payloads for direct portal upload, plus multi-sheet Excel workbooks for audit records.",
      icon: FileJson,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-16 px-6 py-16">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Feature Directory
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          Everything You Need for Error-Free E-Commerce GST Filing
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Built specifically for e-commerce sellers, CAs, and tax accountants.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="space-y-3 rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/40"
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink">
              <f.icon className="size-5" />
            </div>
            <h2 className="text-lg font-bold">{f.title}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-3xl border border-border bg-card p-8 text-center">
        <h2 className="text-xl font-bold">Ready to test these features with your files?</h2>
        <Link
          href="/convert"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90"
        >
          <Zap className="size-4" /> Start Free Conversion Now
        </Link>
      </div>
    </div>
  );
}
