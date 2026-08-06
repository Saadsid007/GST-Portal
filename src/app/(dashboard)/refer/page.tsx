import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gift, Share2, Ticket, UserPlus, Wallet } from "lucide-react";
import { requireSession } from "@/features/auth";
import { getReferralSummary } from "@/features/billing/services/referral.service";
import { getReferralRewards } from "@/features/billing/services/config.service";
import { ReferralPanel } from "@/features/billing/presentation/referral-panel";
import { RedeemCodePanel } from "@/features/billing/presentation/redeem-code-panel";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Refer & earn" };

export default async function ReferPage() {
  const session = await requireSession();
  const [referral, rewards] = await Promise.all([
    getReferralSummary(session.user.id),
    getReferralRewards(),
  ]);

  const { referrerCredits, refereeCredits } = rewards;

  const steps = [
    {
      icon: Share2,
      title: "Share your link",
      body: "Send your personal referral link to another seller or your CA.",
    },
    {
      icon: UserPlus,
      title: "They sign up",
      body: `They create an account through your link and get ${refereeCredits} credits to start with.`,
    },
    {
      icon: Wallet,
      title: "You both earn",
      body: `Once they make their first recharge, ${referrerCredits} credits land in your wallet.`,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Rewards"
        title="Refer & earn"
        description="Credits for you and for whoever you bring along. Credits never expire and work on any return."
        actions={
          <Badge variant="success" size="md">
            <Gift className="size-3" aria-hidden />
            {referrerCredits} credits per referral
          </Badge>
        }
      />

      {/* How it works */}
      <section className="grid gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <Card key={step.title} variant="solid" className="relative p-5">
            <span className="absolute top-4 right-4 text-2xl font-bold text-muted-foreground/15 tabular-nums">
              {i + 1}
            </span>
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary-ink ring-1 ring-primary/20">
              <step.icon className="size-5" aria-hidden />
            </div>
            <h2 className="text-sm font-semibold">{step.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
          </Card>
        ))}
      </section>

      {/* The two actions, each with room to breathe */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="size-4 text-primary-ink" aria-hidden />
            <h2 className="text-base font-semibold tracking-tight">Your referral link</h2>
          </div>
          <ReferralPanel summary={referral} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-primary-ink" aria-hidden />
            <h2 className="text-base font-semibold tracking-tight">Redeem a credit code</h2>
          </div>
          <RedeemCodePanel />
          <Card variant="subtle" className="p-4">
            <p className="text-xs text-muted-foreground">
              Codes are issued for campaigns and support credits. Each one can be redeemed once per
              account and lands in your wallet immediately.
            </p>
          </Card>
        </section>
      </div>

      <Card variant="accent" className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <Wallet className="size-5 flex-shrink-0 text-primary-ink" aria-hidden />
        <p className="flex-1 text-sm">
          Everything you earn here shows up in your wallet ledger alongside recharges and bonuses.
        </p>
        <Link
          href="/billing"
          className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold text-primary-ink hover:underline"
        >
          Open wallet
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </Card>
    </div>
  );
}
