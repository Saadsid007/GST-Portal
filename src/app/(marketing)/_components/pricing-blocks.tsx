import Link from "next/link";
import {
  ArrowRight,
  Check,
  Minus,
  ShieldCheck,
  Lock,
  Sparkles,
  Zap,
  Building2,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PlanDefinition } from "@/features/billing/config/pricing.config";

export function MarketingPlanCard({
  plan,
  featured,
}: {
  plan: PlanDefinition;
  featured?: boolean;
}) {
  const isTrial = plan.slug === "free_trial";
  const isPopular = plan.isPopular;

  return (
    <Card
      variant={isPopular ? "accent" : "solid"}
      className={cn(
        "relative flex flex-col justify-between p-6 transition-all duration-200",
        isPopular && "shadow-xl ring-2 ring-primary/40",
        featured && "md:-translate-y-2"
      )}
    >
      {isPopular && (
        <Badge
          variant="solid"
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-extrabold tracking-wider uppercase shadow-sm"
        >
          <Sparkles className="mr-1 size-2.5" aria-hidden />
          Recommended
        </Badge>
      )}

      <div>
        <div className="space-y-1">
          <p className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
            {plan.name}
          </p>
          <p className="min-h-[32px] text-xs text-muted-foreground">{plan.description}</p>
        </div>

        <div className="my-4 border-y border-border py-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-foreground">
              {isTrial ? "₹0" : `₹${plan.monthlyPrice}`}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {isTrial ? "/ 30 days" : "/ month"}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <Zap className="mr-1 size-3" /> Unlimited GSTR-1
            </span>
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-ink">
              {plan.includedGSTINs} GSTINs Included
            </span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <p className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase">
            Included Capabilities
          </p>
          <ul className="space-y-2">
            {plan.features.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-foreground/90">
                <Check className="mt-0.5 size-3.5 flex-shrink-0 text-emerald-500" />
                <span>{feat}</span>
              </li>
            ))}
            {!isTrial && (
              <li className="flex items-start gap-2 text-xs font-semibold text-primary-ink">
                <Check className="mt-0.5 size-3.5 flex-shrink-0 text-primary-ink" />
                <span>Extra GSTINs @ ₹6/mo each</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <Button asChild variant={isPopular ? "brand" : "outline"} size="sm" block>
          <Link href="/register">
            {isTrial ? "Start 30-Day Free Trial" : `Choose ${plan.name}`}
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

/** Trust strip for money and subscription transparency. */
export function TrustStrip() {
  const items = [
    {
      icon: Zap,
      label: "Unlimited GSTR-1 generation",
      detail: "Zero per-return deduction on active plans",
    },
    {
      icon: Building2,
      label: "GSTIN capacity scaling",
      detail: "Add extra client GSTINs for ₹6/month each",
    },
    {
      icon: ShieldCheck,
      label: "Official GSTN JSON & Excel",
      detail: "100% compliant with Offline Tool v3.0",
    },
    {
      icon: Lock,
      label: "100% Secure Checkout",
      detail: "Encrypted payments via Razorpay UPI & Cards",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} variant="subtle" className="flex items-start gap-3 p-4">
          <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-ink">
            <item.icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">{item.label}</p>
            <p className="mt-0.5 text-2xs text-muted-foreground">{item.detail}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

export interface ComparisonRow {
  feature: string;
  starter: string | boolean;
  growth: string | boolean;
  business: string | boolean;
  caFirm: string | boolean;
}

export function PlanComparison({ rows }: { rows: ComparisonRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-secondary/30 font-bold text-muted-foreground">
          <tr>
            <th className="p-4">Feature</th>
            <th className="p-4">Starter (₹79)</th>
            <th className="bg-primary/5 p-4 text-primary-ink">Growth (₹129)</th>
            <th className="p-4">Business (₹199)</th>
            <th className="p-4">CA Firm (₹799)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, idx) => (
            <tr key={idx} className="transition hover:bg-accent/30">
              <td className="p-4 font-semibold text-foreground">{row.feature}</td>
              <td className="p-4">
                <Cell val={row.starter} />
              </td>
              <td className="bg-primary/5 p-4">
                <Cell val={row.growth} />
              </td>
              <td className="p-4">
                <Cell val={row.business} />
              </td>
              <td className="p-4">
                <Cell val={row.caFirm} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ val }: { val: string | boolean }) {
  if (typeof val === "boolean") {
    return val ? (
      <Check className="size-4 text-emerald-500" />
    ) : (
      <Minus className="size-4 text-muted-foreground/40" />
    );
  }
  return <span className="font-semibold text-foreground">{val}</span>;
}
