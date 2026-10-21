import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Gift,
  Share2,
  Ticket,
  UserPlus,
  Wallet,
  Users,
  CheckCircle2,
  Sparkles,
  Award,
  Crown,
  TrendingUp,
  ShieldCheck,
  Check,
} from "lucide-react";
import { requireSession } from "@/features/auth";
import { getReferralSummary } from "@/features/billing/services/referral.service";
import { getReferralRewards } from "@/features/billing/services/config.service";
import { ReferralPanel } from "@/features/billing/presentation/referral-panel";
import { RedeemCodePanel } from "@/features/billing/presentation/redeem-code-panel";
import { Badge, Card, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Refer & Earn Rewards — GSTPilot" };

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
      number: "01",
      title: "Share your exclusive link",
      body: "Send your unique invite code or 24-hr link to e-commerce sellers, colleagues, or your CA.",
      gradient:
        "border-blue-500/30 bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card dark:from-blue-950/60 dark:via-indigo-950/20 dark:to-card",
      iconClass: "bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400",
    },
    {
      icon: UserPlus,
      number: "02",
      title: "They sign up & recharge",
      body: `They register using your link. On their very first wallet recharge, ₹${refereeCredits} welcome discount credits land in their wallet.`,
      gradient:
        "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.04] to-card dark:from-emerald-950/60 dark:via-teal-950/20 dark:to-card",
      iconClass:
        "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400",
    },
    {
      icon: Wallet,
      number: "03",
      title: "You both earn credits instantly",
      body: `At the exact same moment, ₹${referrerCredits} credits land in your wallet — automatically deducted from your next plan or GSTIN add-on.`,
      gradient:
        "border-purple-500/30 bg-gradient-to-br from-purple-500/[0.12] via-violet-500/[0.04] to-card dark:from-purple-950/60 dark:via-violet-950/20 dark:to-card",
      iconClass: "bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:text-purple-400",
    },
  ];

  const milestoneTiers = [
    {
      tier: "Starter Advocate",
      referrals: "1 – 4 Sellers",
      reward: `₹${referrerCredits} / referral`,
      bonus: "Standard Mutual Credits",
      perks: "Instant automated wallet credit",
      minCount: 1,
      badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    },
    {
      tier: "Silver Growth Partner",
      referrals: "5 – 9 Sellers",
      reward: `₹${referrerCredits} / referral`,
      bonus: "+₹250 Milestone Bonus",
      perks: "Early access to new marketplace parsers",
      minCount: 5,
      badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    },
    {
      tier: "Gold Compliance Champion",
      referrals: "10 – 24 Sellers",
      reward: `₹${referrerCredits} / referral`,
      bonus: "+₹750 Milestone Bonus",
      perks: "Dedicated CA priority desk & fast support",
      minCount: 10,
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    },
    {
      tier: "Platinum Enterprise Elite",
      referrals: "25+ Sellers",
      reward: `₹${referrerCredits} / referral`,
      bonus: "+₹2,000 Milestone Bonus",
      perks: "Custom bulk limits + 1-on-1 account manager",
      minCount: 25,
      badgeColor: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <PageHeader
        eyebrow="Partner & Growth Rewards"
        title="Refer & Earn Wallet Credits"
        description="Give ₹100, Get ₹100. Earn 100 wallet credits for every seller, accountant, or CA you invite. 1 credit = ₹1 flat value off any plan or GSTIN add-on with zero expiration."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="success"
              size="md"
              className="bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-400"
            >
              <Gift className="size-3.5" aria-hidden />₹{referrerCredits} per successful referral
            </Badge>
            <Badge variant="primary" size="md" className="hidden sm:inline-flex">
              <Sparkles className="size-3.5 text-primary-ink" aria-hidden />1 Credit = ₹1 Real Value
            </Badge>
          </div>
        }
      />

      {/* ── Top Highlight Stat Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Friends Invited */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-blue-700 uppercase dark:text-blue-300">
              Friends Invited
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:bg-blue-500/25 dark:text-blue-400">
              <Users className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground tabular-nums">
              {referral.totalReferred}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Sign-ups</span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3 text-blue-500" />
            Joined via your personal invite link
          </p>
        </div>

        {/* 2. Successfully Rewarded */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
              Activated &amp; Rewarded
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400">
              <CheckCircle2 className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground tabular-nums">
              {referral.totalRewarded}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Rewarded
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Check className="size-3 text-emerald-500" />
            Completed their first wallet recharge
          </p>
        </div>

        {/* 3. Total Credits Earned */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-orange-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 dark:from-amber-950/60 dark:via-orange-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-amber-700 uppercase dark:text-amber-300">
              Total Credits Earned
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:bg-amber-500/25 dark:text-amber-400">
              <Wallet className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-amber-950 tabular-nums dark:text-amber-100">
              ₹{referral.creditsEarned}
            </span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Value</span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700/85 dark:text-amber-300/85">
            <Sparkles className="size-3 text-amber-500" />
            Applied automatically at checkout
          </p>
        </div>

        {/* 4. Mutual Reward Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.12] via-violet-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 dark:from-purple-950/60 dark:via-violet-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-purple-700 uppercase dark:text-purple-300">
              Mutual Reward Slab
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:bg-purple-500/25 dark:text-purple-400">
              <Gift className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-purple-950 dark:text-purple-100">
              ₹{referrerCredits} + ₹{refereeCredits}
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-purple-700/85 dark:text-purple-300/85">
            <ShieldCheck className="size-3 text-purple-500" />
            Mutual reward for both parties
          </p>
        </div>
      </div>

      {/* ── How it works: 3 Step Cards ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-foreground uppercase">
            How The Referral Program Works
          </h2>
          <span className="text-2xs font-semibold text-muted-foreground">3 Simple Steps</span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step) => {
            return (
              <Card
                key={step.title}
                variant="solid"
                className={`relative rounded-3xl border p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md ${step.gradient}`}
              >
                <span className="absolute top-4 right-5 text-3xl font-black text-muted-foreground/20 tabular-nums">
                  {step.number}
                </span>
                <div
                  className={`mb-4 flex size-12 items-center justify-center rounded-2xl shadow-xs ${step.iconClass}`}
                >
                  <step.icon className="size-6" aria-hidden />
                </div>
                <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed font-medium text-muted-foreground">
                  {step.body}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Two Actions: Referral Hub & Redeem Code ── */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="size-4 text-primary-ink" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">Your Referral Hub</h2>
          </div>
          <ReferralPanel summary={referral} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-primary-ink" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">Redeem Credit Voucher</h2>
          </div>
          <RedeemCodePanel />
          <Card variant="subtle" className="rounded-2xl border border-border/80 bg-muted/30 p-4.5">
            <div className="flex items-start gap-3">
              <Gift className="mt-0.5 size-4 shrink-0 text-primary-ink" />
              <div className="text-xs leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">How Voucher Codes Work</p>
                <p className="mt-0.5">
                  Promotional and loyalty codes are issued during seasonal campaigns and support
                  resolutions. Codes grant face-value credits directly into your active balance with
                  zero expiration.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </div>

      {/* ── Milestone Rewards & Partner Tier Table ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="size-4 text-amber-500" />
            <h2 className="text-base font-bold text-foreground">
              Partner Milestone Tiers &amp; Bonus Rewards
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Your current referrals:{" "}
            <span className="font-bold text-foreground">{referral.totalRewarded}</span>
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-blue-500/25 bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            {/* Dark Attractive Bluish Table Header */}
            <thead className="border-b border-blue-500/30 bg-gradient-to-r from-[#0B132B] via-[#111C3A] to-[#1C2541] text-xs font-bold tracking-wider text-blue-100 uppercase shadow-xs dark:from-[#080E1E] dark:via-[#0F1932] dark:to-[#0A1224]">
              <tr>
                <th className="px-5 py-3.5">Partner Tier</th>
                <th className="px-5 py-3.5">Qualifying Referrals</th>
                <th className="px-5 py-3.5">Standard Reward</th>
                <th className="px-5 py-3.5">Milestone Bonus</th>
                <th className="px-5 py-3.5">Exclusive Partner Perks</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {milestoneTiers.map((tier, idx) => {
                const isAlternate = idx % 2 === 1;
                const nextTier = milestoneTiers[idx + 1];
                const isCurrentTier =
                  referral.totalRewarded >= tier.minCount &&
                  (!nextTier || referral.totalRewarded < nextTier.minCount);

                return (
                  <tr
                    key={tier.tier}
                    className={cn(
                      "transition-colors hover:bg-blue-500/[0.06] dark:hover:bg-blue-400/[0.08]",
                      isAlternate ? "bg-slate-500/[0.035] dark:bg-slate-400/[0.04]" : "bg-card",
                      isCurrentTier && "border-l-4 border-l-blue-600 bg-blue-500/[0.04]"
                    )}
                  >
                    {/* Tier Name */}
                    <td className="px-5 py-4 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <Award className="size-4 text-blue-500" />}
                        {idx === 1 && <Sparkles className="size-4 text-emerald-500" />}
                        {idx === 2 && <TrendingUp className="size-4 text-amber-500" />}
                        {idx === 3 && <Crown className="size-4 text-purple-500" />}
                        <span>{tier.tier}</span>
                      </div>
                    </td>

                    {/* Referrals Needed */}
                    <td className="px-5 py-4 font-semibold text-muted-foreground">
                      {tier.referrals}
                    </td>

                    {/* Reward */}
                    <td className="px-5 py-4 font-bold text-foreground tabular-nums">
                      {tier.reward}
                    </td>

                    {/* Milestone Bonus */}
                    <td className="px-5 py-4">
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {tier.bonus}
                      </span>
                    </td>

                    {/* Perks */}
                    <td className="px-5 py-4 text-xs text-muted-foreground">{tier.perks}</td>

                    {/* Status Badge */}
                    <td className="px-5 py-4 text-right">
                      {isCurrentTier ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-2xs font-extrabold text-blue-700 dark:text-blue-300">
                          <Check className="size-3" />
                          Current Tier
                        </span>
                      ) : referral.totalRewarded > tier.minCount ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-2xs font-bold text-emerald-700 dark:text-emerald-400">
                          Completed
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted/60 px-3 py-1 text-2xs font-semibold text-muted-foreground">
                          Next Goal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Bottom Wallet Synergy Banner ── */}
      <Card
        variant="solid"
        className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-600/[0.10] via-indigo-600/[0.05] to-card p-6 shadow-sm dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30">
              <Wallet className="size-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                All Referral Credits Auto-Sync To Your Wallet Ledger
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Credits earned from referrals and promo vouchers appear in your real-time ledger on
                the Billing page and are automatically deducted from your next plan recharge or
                GSTIN capacity upgrade.
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="group inline-flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground shadow-2xs transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          >
            <span>Open Wallet &amp; Ledger</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
