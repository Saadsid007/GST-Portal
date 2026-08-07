import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Play, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { SITE } from "@/config/site";
import { DemoGenerator } from "@/features/demo/presentation/demo-generator";
import { PlatformLogo } from "@/features/convert/presentation/platform-logo";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import {
  ClosingCta,
  ComparisonSection,
  FAQS,
  FaqSection,
  FeaturesSection,
  Section,
  TestimonialsSection,
  WorkflowSection,
} from "./_components/home-sections";
import { PricingPreview } from "./_components/pricing-preview";

// Pricing comes from the admin-editable billing_config table, so the prerender
// has to refresh — otherwise a slab edit never reaches the homepage.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "GSTPilot — Convert Amazon, Meesho & Flipkart reports to GSTR-1",
  description:
    "Turn marketplace seller reports into government-ready GSTR-1 JSON and Excel in seconds. Automatic net sales after returns, multi-marketplace merge, TCS reconciliation and one-click auto-fixers.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "GSTPilot — Marketplace reports to GSTR-1 in seconds",
    description:
      "Automatic net sales, multi-marketplace merge and GSTN v3.0 JSON. Try the interactive demo — no signup.",
    url: SITE.url,
    type: "website",
  },
};

const MARKETPLACES = [
  { id: "amazon", name: "Amazon MTR", slug: "amazon-gst-report-generator", note: "v3 supported" },
  { id: "meesho", name: "Meesho", slug: "meesho-gst-report-generator", note: "Sales + returns" },
  {
    id: "flipkart",
    name: "Flipkart",
    slug: "flipkart-gst-report-generator",
    note: "Seller export",
  },
  { id: "myntra", name: "Myntra", slug: "myntra-gst-report-generator", note: "Tax invoices" },
  { id: "jiomart", name: "JioMart", slug: "jiomart-gst-report-generator", note: "Orders export" },
  { id: "shopdeck", name: "Shopdeck", slug: "shopdeck-gst-report-generator", note: "D2C stores" },
  {
    id: "glowroad",
    name: "GlowRoad",
    slug: "glowroad-gst-report-generator",
    note: "Reseller sales",
  },
  {
    id: "snapdeal",
    name: "Snapdeal",
    slug: "snapdeal-gst-report-generator",
    note: "Seller orders",
  },
  { id: "roposo", name: "Roposo Clout", slug: "custom-excel-gst-generator", note: "Clout reports" },
  {
    id: "custom",
    name: "Custom Excel",
    slug: "custom-excel-gst-generator",
    note: "Universal mapper",
  },
];

const HERO_STATS = [
  { value: "10", label: "Marketplaces" },
  { value: "< 5s", label: "To process a month" },
  { value: "3", label: "Files per return" },
  { value: "₹0", label: "To start" },
];

const HERO_PROOF = [
  "GSTN v3.0 compliant output",
  "Net sales after returns",
  "TCS section 52 reconciliation",
];

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE.url}/#organization`,
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        publisher: { "@id": `${SITE.url}/#organization` },
        inLanguage: "en-IN",
      },
      {
        "@type": "SoftwareApplication",
        name: SITE.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: SITE.description,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
          description: "Two free GSTR-1 returns, then pay per return from wallet credits.",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
    ],
  };

  return (
    <div className="space-y-24 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-14 pb-4 md:pt-20">
        {/* Layered backdrop. Each layer is masked so nothing has a visible edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] brand-glow"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] grid-lines [mask-image:radial-gradient(65%_50%_at_50%_0%,black,transparent)] opacity-[0.55]"
        />
        {/* Two soft colour washes, sky and teal, well below text contrast. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-32 -z-10 size-[38rem] rounded-full bg-[hsl(var(--brand)/0.12)] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-32 -z-10 size-[32rem] rounded-full bg-[hsl(var(--teal)/0.10)] blur-3xl"
        />

        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <Link
              href="/changelog"
              className="group inline-flex animate-rise items-center gap-2 rounded-full border border-border bg-card/70 py-1.5 pr-3.5 pl-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:border-primary/40"
            >
              <Badge variant="solid" size="sm">
                New
              </Badge>
              <span className="text-muted-foreground">
                Amazon MTR v3 &amp; TCS reconciliation are live
              </span>
              <ArrowRight
                className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>

            <h1 className="text-[2.5rem] leading-[1.04] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Marketplace reports to{" "}
              <span className="relative whitespace-nowrap">
                <span className="brand-text">GSTR-1</span>
                {/* Hand-drawn underline, sized in em so it tracks the font. */}
                <svg
                  aria-hidden
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1 left-0 h-[0.18em] w-full text-[hsl(var(--brand)/0.45)]"
                >
                  <path
                    d="M2 8c40-6 100-7 196-3"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>
              <br className="hidden sm:block" /> in seconds
            </h1>

            <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Amazon, Flipkart, Meesho and Myntra exports go in. One government-ready GSTR-1 JSON
              and Excel comes out — returns netted off, states coded, tax split correctly.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row">
              <Button asChild variant="brand" size="xl" className="w-full sm:w-auto">
                <Link href="/register">
                  <Zap />
                  Start free — 2 returns
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl" className="w-full sm:w-auto">
                <Link href="#demo">
                  <Play />
                  Try the live demo
                </Link>
              </Button>
            </div>

            <p className="text-2xs text-muted-foreground">
              No card required · Your first two returns are free
            </p>
          </div>

          {/* Proof numbers. Concrete beats adjectives. */}
          <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="bg-card px-4 py-5 text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
                    {stat.value}
                  </span>
                  <span className="mt-0.5 block text-2xs text-muted-foreground">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
            {HERO_PROOF.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Interactive demo ─────────────────────────────────────────────── */}
      <section id="demo" className="mx-auto max-w-6xl scroll-mt-24 space-y-8 px-6">
        <div className="mx-auto max-w-2xl space-y-2.5 text-center">
          <Badge variant="primary" size="md">
            <Sparkles className="size-3" aria-hidden />
            Interactive demo
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            Watch a real conversion, right here
          </h2>
          <p className="text-sm text-muted-foreground">
            Load a sample marketplace export, run it through the pipeline, and compare the raw file
            against the filing-ready output. No signup, no upload.
          </p>
        </div>
        <DemoGenerator />
      </section>

      <WorkflowSection />
      <FeaturesSection />

      {/* ── Marketplaces ─────────────────────────────────────────────────── */}
      <Section
        eyebrow="Coverage"
        title="Every major Indian marketplace"
        description="Dedicated parsers per platform, plus a universal mapper for anything else."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MARKETPLACES.map((m) => (
            <Link
              key={m.name}
              href={`/platforms/${m.slug}`}
              className="group flex card-lift flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center shadow-sm hover:border-primary/40"
            >
              <PlatformLogo
                id={m.id}
                name={m.name}
                accentColor={PLATFORMS_CONFIG.find((c) => c.id === m.id)?.accentColor}
              />
              <p className="text-sm font-semibold transition-colors group-hover:text-primary-ink">
                {m.name}
              </p>
              <p className="mt-1 text-2xs text-muted-foreground">{m.note}</p>
            </Link>
          ))}
        </div>
      </Section>

      <ComparisonSection />

      {/* Rendered inline, not inside Suspense. This route is fully static, so the
          pricing read resolves at build/revalidate time — wrapping it in a
          boundary only forces a streaming shell and parks the markup in a hidden
          div awaiting a client swap. */}
      <PricingPreview />

      <TestimonialsSection />

      {/* ── Security strip ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-subtle px-6 py-8 text-center sm:flex-row sm:text-left">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success-ink ring-1 ring-success/20">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Your sales data stays yours</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Files are transferred over TLS and processed only to produce your return. We never
              sell or share your data.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/security">
              Read the security model
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <FaqSection />
      <ClosingCta />
    </div>
  );
}
