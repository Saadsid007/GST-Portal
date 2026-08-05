import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, Wallet } from "lucide-react";
import { calculateBonus } from "@/features/billing/domain/bonus-calculator";
import { getPricingConfig } from "@/features/billing/services/config.service";
import { CA_PLANS, FREE_TRIAL_LIMITS } from "@/features/billing/constants/billing.constants";

export const metadata: Metadata = {
  title: "Pricing — Pay Per Return, No Subscription",
  description:
    "Recharge your GSTPilot wallet and pay only for the returns you file. 1 credit = ₹1, one GSTR-1 costs 6 credits. Bigger recharges earn bigger bonus credits.",
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

  return (
    <div className="mx-auto max-w-7xl space-y-16 px-6 py-16">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Pay per return
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          No subscription. Recharge your wallet, file when you need to.
        </h1>
        <p className="text-sm text-muted-foreground">
          1 credit = ₹1. One GSTR-1 return costs {generationCost} credits. Credits never expire, and
          every new account gets {FREE_TRIAL_LIMITS.maxGenerations} free returns to try it out
          first.
        </p>
        {campaign?.isActive && (
          <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-warning">
            <Sparkles className="size-3.5" /> {campaign.name} — extra bonus credits on every
            recharge
          </p>
        )}
      </div>

      <section className="space-y-6">
        <h2 className="text-center text-lg font-bold">Wallet recharge packs</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {priced.map((pack) => (
            <div
              key={pack.id}
              className={`relative space-y-3 rounded-2xl border bg-card p-5 transition ${
                pack.popular
                  ? "border-primary shadow-xl ring-2 ring-primary/20"
                  : "border-border shadow-sm"
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-warning px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-warning-foreground uppercase">
                  Most Popular
                </span>
              )}
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {pack.label}
              </p>
              <p className="text-3xl font-extrabold">₹{pack.amount.toLocaleString("en-IN")}</p>
              <div className="space-y-1 border-t border-border pt-3 text-xs">
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Wallet credits</span>
                  <span className="font-semibold tabular-nums">{pack.breakdown.baseCredits}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="font-semibold text-success tabular-nums">
                    +{pack.breakdown.bonusCredits} ({pack.breakdown.bonusPercent}%)
                  </span>
                </p>
                <p className="flex items-center justify-between border-t border-border pt-1">
                  <span className="font-bold">You get</span>
                  <span className="font-extrabold tabular-nums">{pack.breakdown.totalCredits}</span>
                </p>
                <p className="pt-1 text-[11px] text-muted-foreground">
                  ≈ {Math.floor(pack.breakdown.totalCredits / generationCost)} returns
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Custom recharges from ₹20 are also supported — bonus credits start at ₹
          {slabs.find((slab) => slab.bonusPercent > 0)?.minAmount ?? 99}.
        </p>
        <div className="flex justify-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-primary-foreground shadow-sm shadow-primary/20 transition hover:bg-primary/90"
          >
            <Wallet className="size-4" /> Start with {FREE_TRIAL_LIMITS.maxGenerations} free returns
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-lg font-bold">For CA firms & accounting teams</h2>
          <p className="text-xs text-muted-foreground">
            Monthly plans for anyone filing across many client GSTINs. No per-return credits needed.
          </p>
        </div>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {caPlans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col justify-between space-y-6 rounded-3xl border bg-card p-8 shadow-sm transition ${
                plan.id === "CA_PRO" ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              <div className="space-y-4">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">
                    ₹{plan.monthlyPrice.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground">per month</span>
                </div>
                <ul className="space-y-2.5 border-t border-border pt-4 text-xs text-muted-foreground">
                  {CA_FEATURES[plan.id]?.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="size-4 flex-shrink-0 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href="/contact"
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold shadow-sm transition ${
                  plan.id === "CA_PRO"
                    ? "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90"
                    : "border border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                <span>Talk to us</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
