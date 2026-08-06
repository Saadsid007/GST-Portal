import Link from "next/link";
import { ArrowRight, Check, Minus, ShieldCheck, Lock, RefreshCw, Sparkles } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { BonusBreakdown, RechargePack } from "@/features/billing/types/billing.types";

export type PricedPack = RechargePack & { breakdown: BonusBreakdown };

/**
 * One recharge card, shared by the homepage preview and the pricing page so the
 * two can never drift into showing different numbers for the same pack.
 */
export function PackCard({
  pack,
  generationCost,
  featured,
}: {
  pack: PricedPack;
  generationCost: number;
  featured?: boolean;
}) {
  const returns = Math.floor(pack.breakdown.totalCredits / generationCost);
  const effective = pack.amount / Math.max(returns, 1);
  const hasBonus = pack.breakdown.bonusCredits > 0;

  return (
    <Card
      variant={pack.popular ? "accent" : "solid"}
      className={cn(
        "relative flex flex-col p-6 transition-transform duration-200",
        pack.popular && "ring-2 ring-primary/25",
        featured && "md:-translate-y-2"
      )}
    >
      {pack.popular && (
        <Badge variant="solid" className="absolute -top-2.5 left-1/2 -translate-x-1/2 shadow-sm">
          <Sparkles className="size-3" aria-hidden />
          Most popular
        </Badge>
      )}

      <p className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        {pack.label}
      </p>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight tabular-nums">
          ₹{pack.amount.toLocaleString("en-IN")}
        </span>
        <span className="text-xs text-muted-foreground">one-time</span>
      </div>

      {/* The number that actually decides the purchase. */}
      <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-center text-sm font-semibold">
        ≈ {returns} return{returns === 1 ? "" : "s"}
      </p>
      <p className="mt-1.5 text-center text-2xs text-muted-foreground">
        about ₹{effective.toFixed(0)} per return
      </p>

      <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Credits</dt>
          <dd className="font-semibold tabular-nums">{pack.breakdown.baseCredits}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Bonus</dt>
          <dd
            className={cn(
              "font-semibold tabular-nums",
              hasBonus ? "text-success-ink" : "text-muted-foreground"
            )}
          >
            {hasBonus ? `+${pack.breakdown.bonusCredits} (${pack.breakdown.bonusPercent}%)` : "—"}
          </dd>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5">
          <dt className="font-semibold">Total credits</dt>
          <dd className="font-bold tabular-nums">{pack.breakdown.totalCredits}</dd>
        </div>
      </dl>

      <Button asChild variant={pack.popular ? "brand" : "outline"} size="sm" block className="mt-5">
        <Link href="/register">
          Get {pack.breakdown.totalCredits} credits
          <ArrowRight />
        </Link>
      </Button>
    </Card>
  );
}

/** Trust strip. Money questions are trust questions. */
export function TrustStrip() {
  const items = [
    { icon: RefreshCw, label: "Credits never expire", detail: "Use them next month or next year" },
    { icon: Lock, label: "No subscription", detail: "Top up only when you file" },
    { icon: ShieldCheck, label: "Encrypted payments", detail: "UPI via Razorpay, no card stored" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <div
          key={i.label}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
        >
          <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-success/10 text-success-ink ring-1 ring-success/20">
            <i.icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold">{i.label}</span>
            <span className="block text-2xs text-muted-foreground">{i.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export interface ComparisonRow {
  feature: string;
  wallet: string | boolean;
  caPro: string | boolean;
  caElite: string | boolean;
}

/** Plan comparison. Booleans render as a tick or a dash, strings render as-is. */
export function PlanComparison({ rows }: { rows: ComparisonRow[] }) {
  const cell = (value: string | boolean) =>
    typeof value === "boolean" ? (
      value ? (
        <Check className="mx-auto size-4 text-success" aria-label="Included" />
      ) : (
        <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Not included" />
      )
    ) : (
      <span className="text-xs">{value}</span>
    );

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-subtle text-2xs tracking-wide text-muted-foreground uppercase">
            <th className="px-5 py-3.5 text-left font-semibold">Feature</th>
            <th className="px-5 py-3.5 text-center font-semibold">Wallet</th>
            <th className="px-5 py-3.5 text-center font-semibold text-primary-ink">CA Pro</th>
            <th className="px-5 py-3.5 text-center font-semibold">CA Elite</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.feature} className="transition-colors hover:bg-accent/40">
              <td className="px-5 py-3 text-xs font-medium">{row.feature}</td>
              <td className="px-5 py-3 text-center text-muted-foreground">{cell(row.wallet)}</td>
              <td className="px-5 py-3 text-center">{cell(row.caPro)}</td>
              <td className="px-5 py-3 text-center">{cell(row.caElite)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
