import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, HelpCircle } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { PageHero } from "@/app/(marketing)/_components/page-hero";
import {
  MarketingPlanCard,
  PlanComparison,
  TrustStrip,
  type ComparisonRow,
} from "@/app/(marketing)/_components/pricing-blocks";
import {
  ALL_PLANS,
  getCapacityRange,
  getPurchasablePlans,
} from "@/features/billing/config/pricing.config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { faqPageSchema, productSchema, breadcrumbSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing & Plans — Unlimited GSTR-1 Generation",
  description:
    "GSTPilot offers simple, GSTIN-based subscription pricing. Unlimited GSTR-1 generations, 30-day free trial with 7 GSTINs, and plans starting at ₹79/month.",
  path: "/pricing",
});

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Included client GSTINs",
    starter: "10 GSTINs",
    growth: "15 GSTINs",
    business: "30 GSTINs",
    caFirm: "Coming soon",
  },
  { feature: "Monthly price", starter: "₹79", growth: "₹129", business: "₹199", caFirm: "—" },
  {
    feature: "GSTR-1 generations",
    starter: "Unlimited",
    growth: "Unlimited",
    business: "Unlimited",
    caFirm: "Unlimited",
  },
  { feature: "Per-return charge", starter: "₹0", growth: "₹0", business: "₹0", caFirm: "₹0" },
  {
    feature: "Extra GSTIN add-ons",
    starter: "₹6/mo each",
    growth: "₹6/mo each",
    business: "₹6/mo each",
    caFirm: "₹6/mo each",
  },
  {
    feature: "All 10 marketplace parsers",
    starter: true,
    growth: true,
    business: true,
    caFirm: true,
  },
  {
    feature: "Official GSTN JSON v3.0 + multi-sheet Excel",
    starter: true,
    growth: true,
    business: true,
    caFirm: true,
  },
  {
    feature: "Place of supply & tax validation engine",
    starter: true,
    growth: true,
    business: true,
    caFirm: true,
  },
  {
    feature: "Table 14 ECO & Section 52 TCS reconciliation",
    starter: true,
    growth: true,
    business: true,
    caFirm: true,
  },
  {
    feature: "One-click AI error auto-fixers",
    starter: true,
    growth: true,
    business: true,
    caFirm: true,
  },
  {
    feature: "Advanced multi-marketplace merge",
    starter: true,
    growth: true,
    business: true,
    caFirm: true,
  },
  {
    feature: "Multi-client batch processing & ZIP export",
    starter: true,
    growth: true,
    business: true,
    caFirm: true,
  },
  { feature: "Priority support", starter: true, growth: true, business: true, caFirm: true },
  {
    feature: "Team members & staff access",
    starter: false,
    growth: false,
    business: false,
    caFirm: "Coming soon",
  },
  {
    feature: "White label & firm branding",
    starter: false,
    growth: false,
    business: false,
    caFirm: "Coming soon",
  },
  {
    feature: "API access",
    starter: false,
    growth: false,
    business: false,
    caFirm: "Coming soon",
  },
];

const FAQS = [
  {
    q: "How does GSTPilot billing work?",
    a: "GSTPilot uses a transparent subscription model based purely on the number of client GSTINs you manage and your subscription tier. All GSTR-1 return generations inside an active plan or 30-day free trial are 100% UNLIMITED with zero per-report fees.",
  },
  {
    q: "What is included in the 30-Day Free Trial?",
    a: "Every new account receives a full 30-Day Free Trial with 7 GSTIN client capacity. You can generate unlimited, watermark-free GSTR-1 JSON and Excel files without entering any credit card details.",
  },
  {
    q: "Can I add more GSTINs beyond my plan quota?",
    a: "Yes! You can purchase extra GSTIN capacity packs at any time for just ₹6 per GSTIN per month. When purchased mid-cycle, the charge is automatically prorated server-side based on the exact remaining days.",
  },
  {
    q: "Do multiple marketplace files for the same GSTIN cost extra slots?",
    a: "No. 1 GSTIN profile = 1 client slot. You can merge files from Amazon, Flipkart, Meesho, Myntra, JioMart and offline sales under the same GSTIN without consuming additional slots.",
  },
  {
    q: "Will my data or reports be deleted if my subscription expires?",
    a: "Never. Your clients, GSTIN profiles, uploaded files, and historical returns remain permanently safe and accessible in your account. You only need an active plan to generate new filing returns.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support instant, secure payments via Razorpay including UPI (Google Pay, PhonePe, Paytm, BHIM), Net Banking, Debit/Credit Cards, and Corporate accounts.",
  },
];

export const revalidate = 300;

export default async function PricingPage() {
  const capacityRange = getCapacityRange();
  const jsonLd = [
    faqPageSchema(FAQS.map((f) => ({ question: f.q, answer: f.a }))),
    productSchema(
      getPurchasablePlans().map((plan) => ({
        name: plan.name,
        price: plan.monthlyPrice,
        description: `${plan.name} plan with ${plan.includedGSTINs} GSTIN capacity and unlimited GSTR-1 returns.`,
      }))
    ),
  ];

  return (
    <div className="pb-24">
      <JsonLd
        schema={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />
      <JsonLd schema={jsonLd} />

      <PageHero
        eyebrow="Subscription Plans"
        title="One product. Every feature. Pick your GSTIN capacity."
        description="Every paid plan ships the exact same toolkit — unlimited GSTR-1 generation, all marketplace parsers, reconciliation, AI fixes and audit reports. The only thing that changes between plans is how many client GSTINs you can keep active."
      >
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <Sparkles className="size-3.5" aria-hidden />
          Start Free Today — 30 Days Trial • 7 Client GSTINs • No Card Required
        </div>
      </PageHero>

      <div className="mx-auto max-w-7xl space-y-20 px-6 pt-8">
        {/* The single fact that decides which plan someone needs. Stated before
            the cards, so nobody has to diff four feature lists to find it. */}
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-6 py-5 text-center">
          <p className="text-sm font-bold text-foreground">
            Every paid plan includes every feature.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            No tier locks a parser, a report or a reconciliation behind a higher price. Choose a
            plan purely by how many client GSTINs you keep active — from{" "}
            <span className="font-semibold text-foreground">{capacityRange.min}</span> to{" "}
            <span className="font-semibold text-foreground">{capacityRange.max}</span> — and add
            more at ₹6/GSTIN/month whenever you need them.
          </p>
        </div>

        {/* All Plans Grid */}
        <section className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_PLANS.map((plan) => (
              <MarketingPlanCard key={plan.slug} plan={plan} featured={plan.isPopular} />
            ))}
          </div>
        </section>

        {/* Extra GSTIN Add-on Callout */}
        <Card
          variant="subtle"
          className="flex flex-col justify-between gap-6 p-8 md:flex-row md:items-center"
        >
          <div className="max-w-2xl space-y-1.5">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tracking-wider text-primary-ink uppercase">
              Flexible Scaling
            </span>
            <h3 className="text-xl font-bold text-foreground">
              Need extra GSTIN slots for new clients?
            </h3>
            <p className="text-xs text-muted-foreground">
              Add individual GSTIN capacity packs to any plan at just{" "}
              <span className="font-bold text-foreground">₹6 / GSTIN / month</span>. Automatically
              prorated for remaining days in your billing cycle.
            </p>
          </div>
          <Button asChild variant="brand" size="md" className="shrink-0">
            <Link href="/register">
              Get Started Now
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </Card>

        {/* Feature Comparison Matrix */}
        <section className="space-y-6">
          <div className="space-y-1 text-center">
            <span className="text-xs font-bold tracking-wider text-primary-ink uppercase">
              Only the capacity changes
            </span>
            <h2 className="text-2xl font-black text-foreground">Compare plans</h2>
            <p className="text-xs text-muted-foreground">
              Read the first row, then stop — everything below it is identical. Team seats, white
              label and API access arrive with the CA tiers.
            </p>
          </div>

          <PlanComparison rows={COMPARISON_ROWS} />
        </section>

        {/* Trust & Guarantee Strip */}
        <TrustStrip />

        {/* FAQ Section */}
        <section className="space-y-8">
          <div className="space-y-1 text-center">
            <span className="text-xs font-bold tracking-wider text-primary-ink uppercase">
              Frequently Asked Questions
            </span>
            <h2 className="text-2xl font-black text-foreground">
              Everything You Need to Know About Billing
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FAQS.map((faq, idx) => (
              <Card key={idx} variant="solid" className="space-y-2 p-6">
                <p className="flex items-start gap-2 text-sm font-bold text-foreground">
                  <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary-ink" />
                  <span>{faq.q}</span>
                </p>
                <p className="pl-6 text-xs leading-relaxed text-muted-foreground">{faq.a}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
