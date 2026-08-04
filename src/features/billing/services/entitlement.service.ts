import prisma from "@/lib/prisma";
import { CA_PLANS } from "@/features/billing/constants/billing.constants";
import { getFreeTrialLimits, getGenerationCost } from "@/features/billing/services/config.service";
import { getOrCreateWallet } from "@/features/billing/services/wallet.service";
import type {
  CaPlanDefinition,
  CaPlanId,
  WalletSummary,
} from "@/features/billing/types/billing.types";

/**
 * Resolves what a user is allowed to do, from their plan plus their wallet.
 *
 * Kept separate from `wallet.service` on purpose: the wallet only moves credits
 * and knows nothing about plans, while every "can this user do X" question is
 * answered here. Adding GSTR-3B or the HSN validator later means adding a
 * question to this file, not touching the ledger.
 */

const FREE_PLAN = CA_PLANS.find((plan) => plan.id === "FREE") as CaPlanDefinition;

export function planDefinition(planId: CaPlanId): CaPlanDefinition {
  return CA_PLANS.find((plan) => plan.id === planId) ?? FREE_PLAN;
}

/**
 * A subscription only counts while it is ACTIVE and inside its paid period. An
 * expired row silently falls back to FREE rather than granting CA features for
 * free until someone runs a cleanup job.
 */
export async function getActivePlan(userId: string, now: Date = new Date()): Promise<CaPlanId> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription || subscription.status !== "ACTIVE") return "FREE";
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < now) return "FREE";
  return (subscription.plan as CaPlanId) ?? "FREE";
}

/**
 * Everything the wallet card and the /billing page render, already narrowed to
 * plain JSON so it can cross the Server → Client Component boundary.
 */
export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const [wallet, generationCost, trial, plan] = await Promise.all([
    getOrCreateWallet(userId),
    getGenerationCost(),
    getFreeTrialLimits(),
    getActivePlan(userId),
  ]);

  const definition = planDefinition(plan);
  const freeGenerationsRemaining = Math.max(0, trial.maxGenerations - wallet.freeGenerationsUsed);
  // The trial is over the moment a user has paid, even if allowances remain —
  // a paying customer should never see trial messaging or a watermark.
  const isOnFreeTrial =
    plan === "FREE" && wallet.lifetimeRecharged === 0 && freeGenerationsRemaining > 0;

  return {
    balance: wallet.balance,
    lifetimeRecharged: wallet.lifetimeRecharged,
    lifetimeUsed: wallet.lifetimeUsed,
    bonusEarned: wallet.bonusEarned,
    referralEarned: wallet.referralEarned,
    adminCredited: wallet.adminCredited,
    isFrozen: wallet.isFrozen,
    generationCost,
    estimatedReports: Math.floor(wallet.balance / generationCost),
    freeGenerationsUsed: wallet.freeGenerationsUsed,
    freeGenerationsRemaining,
    isOnFreeTrial,
    watermarkApplies: trial.watermark && !definition.watermarkFree && isOnFreeTrial,
    plan,
  };
}

/**
 * Whether generated output must carry the free-trial watermark.
 *
 * Deliberately keyed on "has never paid" rather than "has trial generations
 * left", so a user who spends both free generations cannot re-download the same
 * files unwatermarked. Download actions call this instead of trusting a flag
 * sent up from the browser.
 */
export async function shouldWatermark(userId: string): Promise<boolean> {
  const [plan, trial, wallet] = await Promise.all([
    getActivePlan(userId),
    getFreeTrialLimits(),
    getOrCreateWallet(userId),
  ]);
  if (!trial.watermark) return false;
  if (planDefinition(plan).watermarkFree) return false;
  return wallet.lifetimeRecharged === 0;
}

/**
 * The GSTIN cap. CA plans are unlimited; a wallet user is capped at the trial
 * allowance until their first recharge, after which the cap lifts.
 */
export async function canAddGstin(
  userId: string
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const [plan, trial, wallet] = await Promise.all([
    getActivePlan(userId),
    getFreeTrialLimits(),
    getOrCreateWallet(userId),
  ]);

  if (planDefinition(plan).unlimitedGstins) return { allowed: true };
  if (wallet.lifetimeRecharged > 0) return { allowed: true };

  const count = await prisma.gstinProfile.count({ where: { userId } });
  if (count < trial.maxGstins) return { allowed: true };

  return {
    allowed: false,
    reason: `Your free trial covers ${trial.maxGstins} GSTIN. Recharge your wallet to add more.`,
  };
}
