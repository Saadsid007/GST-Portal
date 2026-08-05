import Link from "next/link";
import {
  ArrowRight,
  Check,
  Sparkles,
  Wallet,
  Building2,
  Infinity as InfinityIcon,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { calculateBonus } from "@/features/billing/domain/bonus-calculator";
import { getPricingConfig } from "@/features/billing/services/config.service";
import { CA_PLANS, FREE_TRIAL_LIMITS } from "@/features/billing/constants/billing.constants";
import { cn } from "@/lib/utils";
import { Section } from "./home-sections";

export async function PricingPreview() {
  const { generationCost, slabs, packs, campaign } = await getPricingConfig();

  // The homepage shows a focused subset; the full ladder lives on /pricing.
  const featured = packs.slice(0, 4).map((pack) => ({
    ...pack,
    breakdown: calculateBonus(pack.amount, slabs, campaign),
  }));
  const caPro = CA_PLANS.find((p) => p.id === "CA_PRO");

  return (
    <Section
      eyebrow="Pricing"
      title="Pay per return, not per month"
      description={`1 credit = ₹1. One GSTR-1 costs ${generationCost} credits. Credits never expire, and bigger recharges earn bonus credits.`}
    >
      {campaign?.isActive && (
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-full border border-warning/25 bg-warning/10 px-4 py-2 text-xs font-semibold text-warning-ink">
          <Sparkles className="size-3.5" aria-hidden />
          {campaign.name} — extra bonus credits on every recharge
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {featured.map((pack) => {
          const returns = Math.floor(pack.breakdown.totalCredits / generationCost);
          return (
            <Card
              key={pack.id}
              variant={pack.popular ? "accent" : "solid"}
              className={cn("relative flex flex-col p-6", pack.popular && "ring-2 ring-primary/25")}
            >
              {pack.popular && (
                <Badge
                  variant="solid"
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 shadow-sm"
                >
                  Most popular
                </Badge>
              )}

              <p className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                {pack.label}
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
                ₹{pack.amount.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">one-time recharge</p>

              <dl className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Credits</dt>
                  <dd className="font-semibold tabular-nums">{pack.breakdown.baseCredits}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Bonus</dt>
                  <dd className="font-semibold text-success-ink tabular-nums">
                    +{pack.breakdown.bonusCredits} ({pack.breakdown.bonusPercent}%)
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <dt className="font-semibold">Total</dt>
                  <dd className="font-bold tabular-nums">{pack.breakdown.totalCredits}</dd>
                </div>
              </dl>

              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-center text-xs font-semibold">
                ≈ {returns} return{returns === 1 ? "" : "s"}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Free trial + CA plan, side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          variant="subtle"
          className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success-ink ring-1 ring-success/20">
              <Wallet className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">Start free</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {FREE_TRIAL_LIMITS.maxGenerations} free returns on {FREE_TRIAL_LIMITS.maxGstins}{" "}
                GSTIN. Watermarked until you recharge.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/register">
              Create account
              <ArrowRight />
            </Link>
          </Button>
        </Card>

        {caPro && (
          <Card
            variant="subtle"
            className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info-ink ring-1 ring-info/20">
                <Building2 className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  For CA firms — from ₹{caPro.monthlyPrice.toLocaleString("en-IN")}/mo
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <InfinityIcon className="size-3" aria-hidden /> Unlimited GSTINs
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3" aria-hidden /> Bulk upload
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3" aria-hidden /> No watermark
                  </span>
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/pricing">
                Compare plans
                <ArrowRight />
              </Link>
            </Button>
          </Card>
        )}
      </div>

      <div className="flex justify-center">
        <Button asChild variant="brand" size="lg">
          <Link href="/pricing">
            See full pricing
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </Section>
  );
}
