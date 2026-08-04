import { BONUS_SLABS } from "@/features/billing/constants/billing.constants";
import type { BonusBreakdown, BonusSlab, Campaign } from "@/features/billing/types/billing.types";

/**
 * Finds the slab covering `amount`. The top slab is open-ended (`maxAmount: null`).
 * Amounts below the lowest slab earn no bonus rather than throwing — the recharge
 * minimum is enforced separately by `rechargeSchema`.
 */
export function findBonusSlab(amount: number, slabs: readonly BonusSlab[]): BonusSlab | null {
  return (
    slabs.find(
      (slab) => amount >= slab.minAmount && (slab.maxAmount === null || amount <= slab.maxAmount)
    ) ?? null
  );
}

function isCampaignLive(campaign: Campaign | null, now: Date): boolean {
  if (!campaign?.isActive) return false;
  if (campaign.startsAt && now < new Date(campaign.startsAt)) return false;
  if (campaign.endsAt && now > new Date(campaign.endsAt)) return false;
  return true;
}

/**
 * Prices a recharge: base credits (1 credit = ₹1) plus the slab bonus, optionally
 * scaled by a live admin campaign.
 *
 * Bonus rounds DOWN — ₹120 at 6% is 127.2, and the user gets 127. Rounding up
 * would let repeated small recharges mint free credits.
 *
 * This is the single pricing function. The recharge dialog's live preview and the
 * server-side order creation both call it, so what the user is shown is exactly
 * what they are credited.
 */
export function calculateBonus(
  amount: number,
  slabs: readonly BonusSlab[] = BONUS_SLABS,
  campaign: Campaign | null = null,
  now: Date = new Date()
): BonusBreakdown {
  const baseCredits = Math.floor(amount);
  const slab = findBonusSlab(baseCredits, slabs);
  const slabPercent = slab?.bonusPercent ?? 0;

  const live = isCampaignLive(campaign, now);
  const effectivePercent =
    live && campaign
      ? slabPercent * campaign.bonusMultiplier + campaign.extraBonusPercent
      : slabPercent;

  const bonusCredits = Math.floor((baseCredits * effectivePercent) / 100);

  return {
    amount: baseCredits,
    baseCredits,
    bonusCredits,
    bonusPercent: effectivePercent,
    totalCredits: baseCredits + bonusCredits,
    campaignName: live && campaign ? campaign.name : null,
  };
}
