import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, Wallet, Building2, Calculator } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { calculateBonus } from "@/features/billing/domain/bonus-calculator";
import { getPricingConfig } from "@/features/billing/services/config.service";
import { CA_PLANS, FREE_TRIAL_LIMITS } from "@/features/billing/constants/billing.constants";
import { SITE } from "@/config/site";
import { PageHero } from "@/app/(marketing)/_components/page-hero";
import {
  PackCard,
  PlanComparison,
  TrustStrip,
  type ComparisonRow,
} from "@/app/(marketing)/_components/pricing-blocks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing — pay per return, no subscription",
  description:
    "Recharge your GSTPilot wallet and pay only for the returns you file. 1 credit = ₹1, one GSTR-1 costs 6 credits. Bigger recharges earn bonus credits, and credits never expire.",
  alternates: { canonical: "/pricing" },
};

const CA_FEATURES: Record<string, string[]> = {
  CA_PRO: [
    "Unlimited client GSTINs",
    "Bulk upload & bulk generation",
    "ZIP downloads",
    "Priority processing queue",
    "No watermark on any output",
    "AI Auto Fix",
    "Client dashboard & history",
    "Full validation reports",
  ],
  CA_ELITE: [
    "Everything in CA Pro",
    "White label reports",
    "Your firm's branding",
    "Team members",
    "API ready",
    "Dedicated support",
  ],
};

const COMPARISON: ComparisonRow[] = [
  { feature: "GSTIN profiles", wallet: "Unlimited", caPro: "Unlimited", caElite: "Unlimited" },
  { feature: "Cost model", wallet: "Per return", caPro: "Monthly", caElite: "Monthly" },
  { feature: "All 10 marketplace parsers", wallet: true, caPro: true, caElite: true },
  { feature: "Net sales engine (sales − returns)", wallet: true, caPro: true, caElite: true },
  { feature: "TCS section 52 reconciliation", wallet: true, caPro: true, caElite: true },
  { feature: "GSTR-1 JSON + Excel output", wallet: true, caPro: true, caElite: true },
  { feature: "Watermark-free output", wallet: "After recharge", caPro: true, caElite: true },
  { feature: "Bulk upload & generation", wallet: false, caPro: true, caElite: true },
  { feature: "Priority processing queue", wallet: false, caPro: true, caElite: true },
  { feature: "Client dashboard", wallet: false, caPro: true, caElite: true },
  { feature: "White label & firm branding", wallet: false, caPro: false, caElite: true },
  { feature: "Team members", wallet: false, caPro: false, caElite: true },
  { feature: "API access", wallet: false, caPro: false, caElite: true },
];

const FAQS = [
  {
    q: "What exactly is a credit?",
    a: "1 credit equals ₹1. Generating one GSTR-1 return costs a fixed number of credits, shown on this page. You buy credits by recharging your wallet, and they are only spent when you generate.",
  },
  {
    q: "Do credits expire?",
    a: "No. Credits stay in your wallet indefinitely, so a quiet month never costs you anything.",
  },
  {
    q: "Is there a subscription for sellers?",
    a: "No. Sellers pay per return out of wallet credits. Monthly plans exist only for CA firms filing at volume across many client GSTINs.",
  },
  {
    q: "How do bonus credits work?",
    a: "Larger recharges earn a percentage of bonus credits on top. The slab is applied automatically at the moment of recharge, and the exact bonus for each pack is shown above.",
  },
  {
    q: "How do I pay?",
    a: "By UPI. We generate a QR for the exact amount that you scan with GPay, PhonePe, Paytm, BHIM or your bank's app. No card details are entered or stored.",
  },
  {
    q: "Can I try it before paying?",
    a: `Yes. Every new account gets ${FREE_TRIAL_LIMITS.maxGenerations} free returns on ${FREE_TRIAL_LIMITS.maxGstins} GSTIN. Output is watermarked until you recharge. You can also run the interactive demo on the homepage without signing up.`,
  },
];

// Prices come from `billing_config`, so this must not be baked in at build time —
// an admin slab edit has to show up on the public page without a redeploy.
export const revalidate = 60;

export default async function PricingPage() {
  const { generationCost, slabs, packs, campaign } = await getPricingConfig();
  const priced = packs.map((pack) => ({
    ...pack,
    breakdown: calculateBonus(pack.amount, slabs, campaign),
  }));
  const caPlans = CA_PLANS.filter((plan) => plan.id !== "FREE");
  const minBonusAmount = slabs.find((slab) => slab.bonusPercent > 0)?.minAmount ?? 99;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        eyebrow="Pricing"
        title="Pay per return, not per month"
        description={
          <>
            1 credit = ₹1. One GSTR-1 costs{" "}
            <span className="font-semibold text-foreground">{generationCost} credits</span>. Credits
            never expire, and every new account starts with {FREE_TRIAL_LIMITS.maxGenerations} free
            returns.
          </>
        }
      >
        {campaign?.isActive && (
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-warning/25 bg-warning/10 px-4 py-2 text-xs font-semibold text-warning-ink">
            <Sparkles className="size-3.5" aria-hidden />
            {campaign.name} — extra bonus credits on every recharge
          </div>
        )}
      </PageHero>

      <div className="mx-auto max-w-6xl space-y-20 px-6 pt-8">
        {/* Recharge packs */}
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {priced.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                generationCost={generationCost}
                featured={pack.popular}
              />
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Custom recharges from ₹20 are supported too — bonus credits start at ₹
            {minBonusAmount.toLocaleString("en-IN")}.
          </p>

          <TrustStrip />
        </section>

        {/* Free trial */}
        <section>
          <Card variant="accent" className="flex flex-col items-center gap-5 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary-ink ring-1 ring-primary/25">
              <Wallet className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Start with {FREE_TRIAL_LIMITS.maxGenerations} free returns
              </h2>
              <p className="mx-auto mt-1.5 max-w-lg text-sm text-muted-foreground">
                No card, no recharge. Convert real files on {FREE_TRIAL_LIMITS.maxGstins} GSTIN and
                see the output before you spend anything — it is watermarked until you top up.
              </p>
            </div>
            <Button asChild variant="brand" size="lg">
              <Link href="/register">
                Create a free account
                <ArrowRight />
              </Link>
            </Button>
          </Card>
        </section>

        {/* CA plans */}
        <section className="space-y-8">
          <div className="mx-auto max-w-2xl space-y-2 text-center">
            <Badge variant="primary" size="md">
              <Building2 className="size-3" aria-hidden />
              For CA firms
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-balance">
              Filing for many clients?
            </h2>
            <p className="text-sm text-muted-foreground">
              Monthly plans for anyone filing across many client GSTINs — no per-return credits
              needed.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
            {caPlans.map((plan) => {
              const isPro = plan.id === "CA_PRO";
              return (
                <Card
                  key={plan.id}
                  variant={isPro ? "accent" : "solid"}
                  className={cn("flex flex-col p-7", isPro && "ring-2 ring-primary/25")}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    {isPro && <Badge variant="solid">Recommended</Badge>}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight tabular-nums">
                      ₹{plan.monthlyPrice.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-muted-foreground">per month</span>
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5 border-t border-border pt-5 text-xs">
                    {CA_FEATURES[plan.id]?.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-3.5 flex-shrink-0 text-success" aria-hidden />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    variant={isPro ? "brand" : "outline"}
                    size="md"
                    block
                    className="mt-6"
                  >
                    <Link href="/contact">
                      Talk to us
                      <ArrowRight />
                    </Link>
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Comparison */}
        <section className="space-y-6">
          <div className="mx-auto max-w-2xl space-y-2 text-center">
            <Badge variant="primary" size="md">
              <Calculator className="size-3" aria-hidden />
              Compare
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-balance">
              What you get on each plan
            </h2>
          </div>
          <PlanComparison rows={COMPARISON} />
        </section>

        {/* FAQ */}
        <section className="space-y-6">
          <div className="mx-auto max-w-2xl space-y-2 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-balance">Pricing questions</h2>
          </div>
          <div className="mx-auto max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold transition-colors hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span
                    aria-hidden
                    className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="px-5 pb-4 text-xs leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section>
          <div className="relative overflow-hidden rounded-3xl brand-gradient px-8 py-12 text-center shadow-xl">
            <div aria-hidden className="absolute inset-0 grid-lines opacity-20 mix-blend-overlay" />
            <div className="relative space-y-4">
              <h2 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">
                Try it before you pay a rupee
              </h2>
              <p className="mx-auto max-w-lg text-sm text-primary-foreground/80">
                {FREE_TRIAL_LIMITS.maxGenerations} free returns, then top up only when you file.
              </p>
              <Button asChild size="xl" className="bg-background text-foreground hover:bg-card">
                <Link href="/register">
                  Start free on {SITE.name}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
