import Link from "next/link";
import {
  ArrowRight,
  Check,
  Sparkles,
  Wallet,
  Building2,
  Infinity as InfinityIcon,
} from "lucide-react";
import { Button, Card } from "@/components/ui";
import { PackCard, TrustStrip } from "@/app/(marketing)/_components/pricing-blocks";
import { calculateBonus } from "@/features/billing/domain/bonus-calculator";
import { getPricingConfig } from "@/features/billing/services/config.service";
import { CA_PLANS, FREE_TRIAL_LIMITS } from "@/features/billing/constants/billing.constants";
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
        {featured.map((pack) => (
          <PackCard key={pack.id} pack={pack} generationCost={generationCost} />
        ))}
      </div>

      <TrustStrip />

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
