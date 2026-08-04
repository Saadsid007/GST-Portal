"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth";
import prisma from "@/lib/prisma";
import { BILLING_CONFIG_KEYS } from "@/features/billing/constants/billing.constants";
import { billingLogger } from "@/features/billing/services/billing.logger";
import {
  createCreditCode,
  listCreditCodes,
  setCreditCodeActive,
  suggestCreditCode,
  type CreditCodeRow,
} from "@/features/billing/services/credit-code.service";
import { getPricingConfig, writeConfig } from "@/features/billing/services/config.service";
import {
  getFreeTrialLimits,
  getReferralRewards,
  getActiveCampaign,
} from "@/features/billing/services/config.service";
import { adjustWallet, setWalletFrozen } from "@/features/billing/services/wallet.service";
import {
  adminCreditSchema,
  bonusSlabsSchema,
  campaignSchema,
  createCreditCodeSchema,
  freeTrialSchema,
  freezeWalletSchema,
  generationCostSchema,
  rechargePacksSchema,
  referralRewardsSchema,
  setPlanSchema,
} from "@/features/billing/schemas/billing.schemas";
import type {
  ActionResult,
  BillingConfigKey,
  BonusSlab,
  Campaign,
  FreeTrialLimits,
  RechargePack,
  ReferralRewards,
} from "@/features/billing/types/billing.types";

/**
 * Every mutation here is admin-only and writes an `AuditLog` row. Config edits take
 * effect on the next read with no deploy, which is the point: seasonal campaigns and
 * slab changes are configuration, not code.
 */

async function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      ...(metadata ? { metadata: metadata as never } : {}),
    },
  });
}

async function saveConfig(
  key: BillingConfigKey,
  value: unknown,
  action: string
): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  await writeConfig(key, value);
  await audit(session.user.id, action, "BillingConfig", key, { value });
  revalidatePath("/admin/billing");
  revalidatePath("/billing");
  return { success: true, data: null };
}

export interface AdminBillingConfig {
  generationCost: number;
  slabs: BonusSlab[];
  packs: RechargePack[];
  rewards: ReferralRewards;
  trial: FreeTrialLimits;
  campaign: Campaign | null;
  creditCodes: CreditCodeRow[];
  suggestedCode: string;
}

export async function getAdminBillingConfigAction(): Promise<ActionResult<AdminBillingConfig>> {
  await requireAdmin();
  const [pricing, rewards, trial, creditCodes] = await Promise.all([
    getPricingConfig(),
    getReferralRewards(),
    getFreeTrialLimits(),
    listCreditCodes(),
  ]);

  return {
    success: true,
    data: {
      generationCost: pricing.generationCost,
      slabs: pricing.slabs,
      packs: pricing.packs,
      rewards,
      trial,
      campaign: pricing.campaign,
      creditCodes,
      suggestedCode: suggestCreditCode(),
    },
  };
}

export async function saveBonusSlabsAction(slabs: unknown): Promise<ActionResult<null>> {
  await requireAdmin();
  const parsed = bonusSlabsSchema.safeParse(slabs);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid slab table" };
  }
  return saveConfig(BILLING_CONFIG_KEYS.bonusSlabs, parsed.data, "BONUS_SLABS_UPDATED");
}

export async function saveRechargePacksAction(packs: unknown): Promise<ActionResult<null>> {
  await requireAdmin();
  const parsed = rechargePacksSchema.safeParse(packs);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid packs" };
  }
  return saveConfig(BILLING_CONFIG_KEYS.rechargePacks, parsed.data, "RECHARGE_PACKS_UPDATED");
}

export async function saveGenerationCostAction(cost: number): Promise<ActionResult<null>> {
  await requireAdmin();
  const parsed = generationCostSchema.safeParse({ cost });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid cost" };
  }
  return saveConfig(
    BILLING_CONFIG_KEYS.generationCost,
    parsed.data.cost,
    "GENERATION_COST_UPDATED"
  );
}

export async function saveReferralRewardsAction(rewards: unknown): Promise<ActionResult<null>> {
  await requireAdmin();
  const parsed = referralRewardsSchema.safeParse(rewards);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid rewards" };
  }
  return saveConfig(BILLING_CONFIG_KEYS.referralRewards, parsed.data, "REFERRAL_REWARDS_UPDATED");
}

export async function saveFreeTrialAction(trial: unknown): Promise<ActionResult<null>> {
  await requireAdmin();
  const parsed = freeTrialSchema.safeParse(trial);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid trial limits" };
  }
  return saveConfig(BILLING_CONFIG_KEYS.freeTrial, parsed.data, "FREE_TRIAL_UPDATED");
}

export async function saveCampaignAction(campaign: unknown): Promise<ActionResult<null>> {
  await requireAdmin();
  // `null` clears the campaign entirely, which is how a promotion is ended.
  if (campaign === null) {
    return saveConfig(BILLING_CONFIG_KEYS.activeCampaign, null, "CAMPAIGN_CLEARED");
  }
  const parsed = campaignSchema.safeParse(campaign);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign" };
  }
  return saveConfig(BILLING_CONFIG_KEYS.activeCampaign, parsed.data, "CAMPAIGN_UPDATED");
}

export async function createCreditCodeAction(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  const parsed = createCreditCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid code" };
  }

  try {
    await createCreditCode(session.user.id, parsed.data);
    revalidatePath("/admin/billing");
    return { success: true, data: null };
  } catch (error) {
    billingLogger.error({ err: error }, "Credit code creation failed");
    return { success: false, error: "That code already exists. Pick another." };
  }
}

export async function setCreditCodeActiveAction(
  creditCodeId: string,
  isActive: boolean
): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  await setCreditCodeActive(session.user.id, creditCodeId, isActive);
  revalidatePath("/admin/billing");
  return { success: true, data: null };
}

export interface AdminWalletRow {
  userId: string;
  name: string;
  email: string;
  plan: string;
  balance: number;
  lifetimeRecharged: number;
  lifetimeUsed: number;
  freeGenerationsUsed: number;
  isFrozen: boolean;
}

export async function searchWalletsAction(query: string): Promise<ActionResult<AdminWalletRow[]>> {
  await requireAdmin();
  const term = query.trim();

  const users = await prisma.user.findMany({
    where: term
      ? {
          OR: [
            { email: { contains: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { wallet: true, subscription: true },
  });

  return {
    success: true,
    data: users.map((user) => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      plan: user.subscription?.plan ?? "FREE",
      balance: user.wallet?.balance ?? 0,
      lifetimeRecharged: user.wallet?.lifetimeRecharged ?? 0,
      lifetimeUsed: user.wallet?.lifetimeUsed ?? 0,
      freeGenerationsUsed: user.wallet?.freeGenerationsUsed ?? 0,
      isFrozen: user.wallet?.isFrozen ?? false,
    })),
  };
}

/** Positive credits, or negative to claw back. Either way it lands in the ledger. */
export async function adminCreditAction(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  const parsed = adminCreditSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await adjustWallet({
      userId: parsed.data.userId,
      credits: parsed.data.credits,
      description: parsed.data.reason,
      type: "ADMIN_CREDIT",
    });
    await audit(session.user.id, "ADMIN_CREDIT", "Wallet", parsed.data.userId, {
      credits: parsed.data.credits,
      reason: parsed.data.reason,
    });
    revalidatePath("/admin/billing");
    return { success: true, data: null };
  } catch (error) {
    billingLogger.error({ err: error }, "Admin credit failed");
    return { success: false, error: "Could not adjust that wallet." };
  }
}

export async function freezeWalletAction(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  const parsed = freezeWalletSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await setWalletFrozen(parsed.data.userId, parsed.data.isFrozen);
  await audit(
    session.user.id,
    parsed.data.isFrozen ? "WALLET_FROZEN" : "WALLET_UNFROZEN",
    "Wallet",
    parsed.data.userId,
    { reason: parsed.data.reason }
  );
  revalidatePath("/admin/billing");
  return { success: true, data: null };
}

/** Grants or revokes a CA plan. `monthsValid: null` means it never expires. */
export async function setPlanAction(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  const parsed = setPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const currentPeriodEnd =
    parsed.data.monthsValid === null
      ? null
      : new Date(Date.now() + parsed.data.monthsValid * 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { userId: parsed.data.userId },
    create: { userId: parsed.data.userId, plan: parsed.data.plan, currentPeriodEnd },
    update: { plan: parsed.data.plan, status: "ACTIVE", currentPeriodEnd },
  });

  await audit(session.user.id, "PLAN_SET", "Subscription", parsed.data.userId, {
    plan: parsed.data.plan,
    monthsValid: parsed.data.monthsValid,
  });
  revalidatePath("/admin/billing");
  return { success: true, data: null };
}

export async function getCampaignAction(): Promise<ActionResult<Campaign | null>> {
  await requireAdmin();
  return { success: true, data: await getActiveCampaign() };
}
