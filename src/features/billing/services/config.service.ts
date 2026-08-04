import prisma from "@/lib/prisma";
import {
  BILLING_CONFIG_KEYS,
  BONUS_SLABS,
  FREE_TRIAL_LIMITS,
  GENERATION_COST,
  RECHARGE_PACKS,
  REFERRAL_REWARDS,
} from "@/features/billing/constants/billing.constants";
import {
  bonusSlabsSchema,
  campaignSchema,
  freeTrialSchema,
  generationCostSchema,
  rechargePacksSchema,
  referralRewardsSchema,
} from "@/features/billing/schemas/billing.schemas";
import type {
  BillingConfigKey,
  BonusSlab,
  Campaign,
  FreeTrialLimits,
  RechargePack,
  ReferralRewards,
} from "@/features/billing/types/billing.types";
import { billingLogger } from "@/features/billing/services/billing.logger";

/**
 * Reads one admin-editable config row and validates it. A missing row is normal
 * (nothing seeded yet); a malformed row means someone edited the database by hand,
 * so it is logged and the compiled default is used rather than mis-pricing a sale.
 */
async function readConfig<T>(
  key: BillingConfigKey,
  parse: (value: unknown) => { success: true; data: T } | { success: false },
  fallback: T
): Promise<T> {
  const row = await prisma.billingConfig.findUnique({ where: { key } });
  if (!row) return fallback;

  const parsed = parse(row.value);
  if (!parsed.success) {
    billingLogger.warn({ key }, "Invalid billing config row — falling back to defaults");
    return fallback;
  }
  return parsed.data;
}

export async function getGenerationCost(): Promise<number> {
  // The row stores a bare number, not `{ cost }` — that shape only exists as the
  // admin form's payload.
  return readConfig(
    BILLING_CONFIG_KEYS.generationCost,
    (value) => generationCostSchema.shape.cost.safeParse(value),
    GENERATION_COST
  );
}

export async function getBonusSlabs(): Promise<BonusSlab[]> {
  return readConfig(BILLING_CONFIG_KEYS.bonusSlabs, (value) => bonusSlabsSchema.safeParse(value), [
    ...BONUS_SLABS,
  ]);
}

export async function getRechargePacks(): Promise<RechargePack[]> {
  return readConfig(
    BILLING_CONFIG_KEYS.rechargePacks,
    (value) => rechargePacksSchema.safeParse(value),
    [...RECHARGE_PACKS]
  );
}

export async function getReferralRewards(): Promise<ReferralRewards> {
  return readConfig(
    BILLING_CONFIG_KEYS.referralRewards,
    (value) => referralRewardsSchema.safeParse(value),
    REFERRAL_REWARDS
  );
}

export async function getFreeTrialLimits(): Promise<FreeTrialLimits> {
  return readConfig(
    BILLING_CONFIG_KEYS.freeTrial,
    (value) => freeTrialSchema.safeParse(value),
    FREE_TRIAL_LIMITS
  );
}

export async function getActiveCampaign(): Promise<Campaign | null> {
  // A cleared campaign is stored as JSON `null`, which is a valid value rather
  // than a malformed row — so it must not trip the fallback warning.
  return readConfig(
    BILLING_CONFIG_KEYS.activeCampaign,
    (value) => campaignSchema.nullable().safeParse(value),
    null
  );
}

/**
 * Everything pricing needs, in one round trip. Used by the recharge flow so the
 * preview and the order are priced from an identical snapshot.
 */
export async function getPricingConfig(): Promise<{
  generationCost: number;
  slabs: BonusSlab[];
  packs: RechargePack[];
  campaign: Campaign | null;
}> {
  const [generationCost, slabs, packs, campaign] = await Promise.all([
    getGenerationCost(),
    getBonusSlabs(),
    getRechargePacks(),
    getActiveCampaign(),
  ]);
  return { generationCost, slabs, packs, campaign };
}

/** Upserts a config row. Callers are responsible for validating and audit-logging. */
export async function writeConfig(key: BillingConfigKey, value: unknown): Promise<void> {
  await prisma.billingConfig.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}
