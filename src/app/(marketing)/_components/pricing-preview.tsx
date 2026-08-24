import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { MarketingPlanCard, TrustStrip } from "@/app/(marketing)/_components/pricing-blocks";
import { ALL_PLANS } from "@/features/billing/config/pricing.config";
import { Section } from "./home-sections";

export async function PricingPreview() {
  // Show key individual, growth and business plans on the homepage preview
  const featured = ALL_PLANS.slice(0, 4);

  return (
    <Section
      eyebrow="Pricing &amp; Plans"
      title="Simple, GSTIN-Based Pricing. Unlimited GSTR-1."
      description="No per-generation charges. All active plans include unlimited GSTR-1 returns, authentic Excel/JSON, and multi-marketplace reconciliation."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {featured.map((plan) => (
          <MarketingPlanCard key={plan.slug} plan={plan} />
        ))}
      </div>

      <TrustStrip />

      {/* CA Pro & Enterprise Card */}
      <Card
        variant="subtle"
        className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-ink ring-1 ring-primary/20">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">
              For CA Firms &amp; Tax Practitioners — Up to 200 Client GSTINs
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              CA Pro (75 GSTINs @ ₹399/mo) and CA Firm (200 GSTINs @ ₹799/mo) with bulk client
              processing, team members &amp; white-label exports.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/pricing">
            View All Plans &amp; Comparison
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </Card>
    </Section>
  );
}
