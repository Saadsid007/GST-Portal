import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, Building2, Zap, ShieldCheck, HelpCircle } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { PageHero } from "@/app/(marketing)/_components/page-hero";
import {
  MarketingPlanCard,
  PlanComparison,
  TrustStrip,
  type ComparisonRow,
} from "@/app/(marketing)/_components/pricing-blocks";
import { ALL_PLANS, PLANS } from "@/features/billing/config/pricing.config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { faqPageSchema, productSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing & Plans — Unlimited GSTR-1 Generation | GSTPilot",
  description:
    "GSTPilot offers simple, GSTIN-based subscription pricing. Unlimited GSTR-1 generations, 30-day free trial with 7 GSTINs, and plans starting at ₹79/month.",
  path: "/pricing",
});

const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "Included Client GSTINs", starter: "10 GSTINs", growth: "15 GSTINs", business: "30 GSTINs", caFirm: "200 GSTINs" },
  { feature: "GSTR-1 Generation Limit", starter: "Unlimited", growth: "Unlimited", business: "Unlimited", caFirm: "Unlimited" },
  { feature: "Per-return charge", starter: "₹0", growth: "₹0", business: "₹0", caFirm: "₹0" },
  { feature: "All 10 Marketplace Parsers", starter: true, growth: true, business: true, caFirm: true },
  { feature: "Official GSTN JSON v3.0 + Multi-Sheet Excel", starter: true, growth: true, business: true, caFirm: true },
  { feature: "Place of Supply & Tax Validation Engine", starter: true, growth: true, business: true, caFirm: true },
  { feature: "Table 14 ECO & Section 52 TCS Reconciliation", starter: false, growth: true, business: true, caFirm: true },
  { feature: "One-Click AI Error Auto-Fixers", starter: false, growth: true, business: true, caFirm: true },
  { feature: "Advanced Multi-Marketplace Merge", starter: false, growth: true, business: true, caFirm: true },
  { feature: "Multi-client Batch Processing & ZIP Export", starter: false, growth: false, business: true, caFirm: true },
  { feature: "Team Members & Staff Access", starter: false, growth: false, business: false, caFirm: true },
  { feature: "White Label & Firm Branding Reports", starter: false, growth: false, business: false, caFirm: true },
  { feature: "Additional GSTIN Add-ons", starter: "₹6/mo each", growth: "₹6/mo each", business: "₹6/mo each", caFirm: "₹6/mo each" },
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
  const jsonLd = [
    faqPageSchema(FAQS.map((f) => ({ question: f.q, answer: f.a }))),
    productSchema(
      ALL_PLANS.map((plan) => ({
        name: plan.name,
        price: plan.monthlyPrice,
        description: `${plan.name} plan with ${plan.includedGSTINs} GSTIN capacity and unlimited GSTR-1 returns.`,
      }))
    ),
  ];

  return (
    <div className="pb-24">
      <JsonLd schema={jsonLd} />

      <PageHero
        eyebrow="Subscription Plans"
        title="Unlimited GSTR-1 Generation. Simple GSTIN-Based Pricing."
        description="Every active plan includes unlimited return filings, authentic Excel/JSON exports, and automated reconciliation. Pay only for the client capacity you need."
      >
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <Sparkles className="size-3.5" aria-hidden />
          Start Free Today — 30 Days Trial • 7 Client GSTINs • No Card Required
        </div>
      </PageHero>

      <div className="mx-auto max-w-7xl space-y-20 px-6 pt-8">
        {/* All Plans Grid */}
        <section className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_PLANS.map((plan) => (
              <MarketingPlanCard key={plan.slug} plan={plan} featured={plan.isPopular} />
            ))}
          </div>
        </section>

        {/* Extra GSTIN Add-on Callout */}
        <Card variant="subtle" className="flex flex-col justify-between gap-6 p-8 md:flex-row md:items-center">
          <div className="space-y-1.5 max-w-2xl">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary-ink uppercase tracking-wider">
              Flexible Scaling
            </span>
            <h3 className="text-xl font-bold text-foreground">
              Need extra GSTIN slots for new clients?
            </h3>
            <p className="text-xs text-muted-foreground">
              Add individual GSTIN capacity packs to any plan at just <span className="font-bold text-foreground">₹6 / GSTIN / month</span>. Automatically prorated for remaining days in your billing cycle.
            </p>
          </div>
          <Button asChild variant="brand" size="md" className="shrink-0">
            <Link href="/register">
              Get Started Now
              <ArrowRight className="size-4 ml-1.5" />
            </Link>
          </Button>
        </Card>

        {/* Feature Comparison Matrix */}
        <section className="space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold tracking-wider text-primary-ink uppercase">
              Full Feature Comparison
            </span>
            <h2 className="text-2xl font-black text-foreground">
              Compare Plan Capabilities
            </h2>
            <p className="text-xs text-muted-foreground">
              Choose the right tier for individual sellers, growing e-commerce merchants, and large CA firms.
            </p>
          </div>

          <PlanComparison rows={COMPARISON_ROWS} />
        </section>

        {/* Trust & Guarantee Strip */}
        <TrustStrip />

        {/* FAQ Section */}
        <section className="space-y-8">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold tracking-wider text-primary-ink uppercase">
              Frequently Asked Questions
            </span>
            <h2 className="text-2xl font-black text-foreground">
              Everything You Need to Know About Billing
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FAQS.map((faq, idx) => (
              <Card key={idx} variant="solid" className="p-6 space-y-2">
                <p className="flex items-start gap-2 text-sm font-bold text-foreground">
                  <HelpCircle className="size-4 text-primary-ink shrink-0 mt-0.5" />
                  <span>{faq.q}</span>
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  {faq.a}
                </p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
