/**
 * Seeded defaults for the billing system.
 *
 * These are only the initial values and the fallback used when a BillingConfig
 * row is missing. The live values come from the `billing_config` table so an
 * admin can change pricing, bonus slabs, referral rewards and campaigns with no
 * code change and no deploy — read them through
 * `@/features/billing/services/config.service`, never import these directly
 * into runtime pricing logic.
 */

import type {
  BonusSlab,
  CaPlanDefinition,
  FreeTrialLimits,
  RechargePack,
  ReferralRewards,
} from "@/features/billing/types/billing.types";

/** Every ledger entry type. `WalletTransaction.type` is a plain String column. */
export const TRANSACTION_TYPES = [
  "RECHARGE",
  "BONUS",
  "GENERATION",
  "REFERRAL_REWARD",
  "ADMIN_CREDIT",
  "REFUND",
  "ADJUSTMENT",
  "PROMO_CODE",
  "CAMPAIGN",
  "FREE_TRIAL",
] as const;

/** Types that add credits. Everything else is a debit or a zero-value audit row. */
export const CREDIT_TRANSACTION_TYPES = [
  "RECHARGE",
  "BONUS",
  "REFERRAL_REWARD",
  "ADMIN_CREDIT",
  "REFUND",
  "PROMO_CODE",
  "CAMPAIGN",
] as const;

export const RECHARGE_ORDER_STATUSES = ["CREATED", "PAID", "FAILED"] as const;
export const REFERRAL_STATUSES = ["PENDING", "REWARDED", "BLOCKED"] as const;
export const USER_ROLES = ["USER", "ADMIN"] as const;
export const CA_PLAN_IDS = ["FREE", "CA_PRO", "CA_ELITE"] as const;

/** Keys of the admin-editable `billing_config` rows. */
export const BILLING_CONFIG_KEYS = {
  generationCost: "generation_cost",
  bonusSlabs: "bonus_slabs",
  rechargePacks: "recharge_packs",
  referralRewards: "referral_rewards",
  freeTrial: "free_trial",
  activeCampaign: "active_campaign",
} as const;

/** 1 Credit = ₹1. One GSTR-1 generation costs this many credits. */
export const GENERATION_COST = 6;

export const MIN_RECHARGE_AMOUNT = 20;
export const MAX_RECHARGE_AMOUNT = 10_000;

/**
 * Wallet bonus slabs. Deliberately 0% below ₹99 so a custom recharge never
 * out-competes the named packs: a one-time trier tops up ₹20–50, while a
 * regular user self-selects ₹199 or ₹499 because the extra value is visible.
 */
export const BONUS_SLABS: readonly BonusSlab[] = [
  { minAmount: 20, maxAmount: 98, bonusPercent: 0 },
  { minAmount: 99, maxAmount: 198, bonusPercent: 6 },
  { minAmount: 199, maxAmount: 498, bonusPercent: 10 },
  { minAmount: 499, maxAmount: 998, bonusPercent: 15 },
  { minAmount: 999, maxAmount: 1998, bonusPercent: 20 },
  { minAmount: 1999, maxAmount: null, bonusPercent: 25 },
] as const;

export const RECHARGE_PACKS: readonly RechargePack[] = [
  { id: "starter", label: "Starter", amount: 99, popular: false },
  { id: "growth", label: "Growth", amount: 199, popular: true },
  { id: "business", label: "Business", amount: 499, popular: false },
  { id: "pro", label: "Pro", amount: 999, popular: false },
  { id: "enterprise", label: "Enterprise", amount: 1999, popular: false },
] as const;

/**
 * Free trial allowances. These are usage grants, NOT credits — a free
 * generation never mints wallet credits, it only increments a counter.
 */
export const FREE_TRIAL_LIMITS: FreeTrialLimits = {
  maxGstins: 1,
  maxGenerations: 2,
  watermark: true,
};

/** Paid out only after the referred user's first successful Razorpay recharge. */
export const REFERRAL_REWARDS: ReferralRewards = {
  referrerCredits: 25,
  refereeCredits: 25,
};

export const REFERRAL_CODE_PREFIX = "GSTP";
export const REFERRAL_TOKEN_TTL_HOURS = 24;

export const CA_PLANS: readonly CaPlanDefinition[] = [
  {
    id: "FREE",
    name: "Wallet (Pay as you go)",
    monthlyPrice: 0,
    unlimitedGstins: false,
    watermarkFree: false,
    bulkUpload: false,
    priorityQueue: false,
    aiAutoFix: false,
    clientDashboard: false,
    whiteLabel: false,
    teamMembers: false,
    apiAccess: false,
  },
  {
    id: "CA_PRO",
    name: "CA Pro",
    monthlyPrice: 999,
    unlimitedGstins: true,
    watermarkFree: true,
    bulkUpload: true,
    priorityQueue: true,
    aiAutoFix: true,
    clientDashboard: true,
    whiteLabel: false,
    teamMembers: false,
    apiAccess: false,
  },
  {
    id: "CA_ELITE",
    name: "CA Elite",
    monthlyPrice: 2499,
    unlimitedGstins: true,
    watermarkFree: true,
    bulkUpload: true,
    priorityQueue: true,
    aiAutoFix: true,
    clientDashboard: true,
    whiteLabel: true,
    teamMembers: true,
    apiAccess: true,
  },
] as const;

export const WATERMARK_TEXT =
  "Generated with GSTPilot Free Trial — recharge your wallet to remove this watermark";
