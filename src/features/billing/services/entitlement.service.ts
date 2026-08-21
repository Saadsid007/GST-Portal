/**
 * Entitlement Service for GSTPilot
 * Authoritative server-side feature access, subscription status,
 * and capability enforcement.
 */

import {
  getPlanDefinition,
  type PlanCapabilities,
  type PlanSlug,
} from "@/features/billing/config/pricing.config";
import {
  getOrCreateSubscription,
  type SubscriptionStatusSummary,
} from "@/features/billing/services/subscription.service";
import {
  canCreateGstin,
  getGstinCapacity,
  type GSTINCapacityStatus,
} from "@/features/billing/services/capacity.service";
import { getOrCreateWallet } from "@/features/billing/services/wallet.service";
import type { WalletSummary } from "@/features/billing/types/billing.types";

export interface WorkspaceEntitlements {
  userId: string;
  subscription: SubscriptionStatusSummary;
  capacity: GSTINCapacityStatus;
  capabilities: PlanCapabilities;
  canGenerateGstr1: boolean;
  watermark: boolean;
}

/**
 * Returns complete server-side authoritative entitlements for a user workspace.
 */
export async function getWorkspaceEntitlements(
  userId: string,
  now: Date = new Date()
): Promise<WorkspaceEntitlements> {
  const [subscription, capacity] = await Promise.all([
    getOrCreateSubscription(userId, now),
    getGstinCapacity(userId, now),
  ]);

  const planDef = getPlanDefinition(subscription.planSlug);
  const canGenerateGstr1 = subscription.isActive;
  // Per business rule: No watermark on GSTR-1 output
  const watermark = false;

  return {
    userId,
    subscription,
    capacity,
    capabilities: planDef.capabilities,
    canGenerateGstr1,
    watermark,
  };
}

/**
 * Checks whether the user's workspace has access to a specific premium feature.
 */
export async function hasFeatureAccess(
  userId: string,
  feature: keyof PlanCapabilities
): Promise<boolean> {
  const sub = await getOrCreateSubscription(userId);
  if (!sub.isActive) return false;

  const planDef = getPlanDefinition(sub.planSlug);
  return Boolean(planDef.capabilities[feature]);
}

/**
 * Watermark check — returns false for all valid subscriptions & trials.
 */
export async function shouldWatermark(_userId: string): Promise<boolean> {
  return false;
}

/**
 * Helper to get active plan slug.
 */
export async function getActivePlan(userId: string): Promise<PlanSlug> {
  const sub = await getOrCreateSubscription(userId);
  return sub.planSlug;
}

/**
 * Helper for backwards-compatible plan definition lookup.
 */
export function planDefinition(planSlug: any) {
  return getPlanDefinition(planSlug);
}

/**
 * Backward-compatible helper for legacy components / wallet summary.
 */
export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const [ent, wallet] = await Promise.all([
    getWorkspaceEntitlements(userId),
    getOrCreateWallet(userId).catch(() => ({
      balance: 0,
      lifetimeRecharged: 0,
      lifetimeUsed: 0,
      bonusEarned: 0,
      referralEarned: 0,
      adminCredited: 0,
      freeGenerationsUsed: 0,
      isFrozen: false,
    })),
  ]);

  return {
    balance: wallet.balance,
    lifetimeRecharged: wallet.lifetimeRecharged,
    lifetimeUsed: wallet.lifetimeUsed,
    bonusEarned: wallet.bonusEarned,
    referralEarned: wallet.referralEarned,
    adminCredited: wallet.adminCredited,
    isFrozen: wallet.isFrozen,
    generationCost: 0,
    estimatedReports: 999999,
    freeGenerationsUsed: 0,
    freeGenerationsRemaining: ent.subscription.daysRemaining,
    isOnFreeTrial: ent.subscription.isTrial,
    watermarkApplies: false,
    plan: ent.subscription.planSlug,
  };
}

/**
 * Backward-compatible helper for GSTIN addition check.
 */
export async function canAddGstin(
  userId: string
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const res = await canCreateGstin(userId);
  if (res.allowed) return { allowed: true };
  return { allowed: false, reason: res.reason };
}
