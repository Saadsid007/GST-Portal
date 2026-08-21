import type {
  BILLING_CONFIG_KEYS,
  CA_PLAN_IDS,
  RECHARGE_ORDER_STATUSES,
  REFERRAL_STATUSES,
  TRANSACTION_TYPES,
  USER_ROLES,
} from "@/features/billing/constants/billing.constants";

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type RechargeOrderStatus = (typeof RECHARGE_ORDER_STATUSES)[number];
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type CaPlanId = (typeof CA_PLAN_IDS)[number];
export type BillingConfigKey = (typeof BILLING_CONFIG_KEYS)[keyof typeof BILLING_CONFIG_KEYS];

/** `maxAmount: null` means the slab is open-ended (the top slab). */
export interface BonusSlab {
  minAmount: number;
  maxAmount: number | null;
  bonusPercent: number;
}

export interface RechargePack {
  id: string;
  label: string;
  amount: number;
  popular: boolean;
}

export interface FreeTrialLimits {
  maxGstins: number;
  maxGenerations: number;
  watermark: boolean;
}

export interface ReferralRewards {
  referrerCredits: number;
  refereeCredits: number;
}

/**
 * An admin-configured seasonal promotion (Diwali, filing season, FY end,
 * cashback). Adding a campaign is a config edit, never a code change.
 * `bonusMultiplier` scales the slab bonus: 1.5 turns a 10% slab into 15%.
 */
export interface Campaign {
  id: string;
  name: string;
  isActive: boolean;
  bonusMultiplier: number;
  extraBonusPercent: number;
  startsAt: string | null;
  endsAt: string | null;
}

export interface CaPlanDefinition {
  id: CaPlanId;
  name: string;
  monthlyPrice: number;
  unlimitedGstins: boolean;
  watermarkFree: boolean;
  bulkUpload: boolean;
  priorityQueue: boolean;
  aiAutoFix: boolean;
  clientDashboard: boolean;
  whiteLabel: boolean;
  teamMembers: boolean;
  apiAccess: boolean;
}

/** Result of pricing a recharge amount. `total` is what lands in the wallet. */
export interface BonusBreakdown {
  amount: number;
  baseCredits: number;
  bonusCredits: number;
  bonusPercent: number;
  totalCredits: number;
  campaignName: string | null;
}

/** Everything the wallet card and /billing page need, already serialisable. */
export interface WalletSummary {
  balance: number;
  lifetimeRecharged: number;
  lifetimeUsed: number;
  bonusEarned: number;
  referralEarned: number;
  adminCredited: number;
  isFrozen: boolean;
  generationCost: number;
  estimatedReports: number;
  freeGenerationsUsed: number;
  freeGenerationsRemaining: number;
  isOnFreeTrial: boolean;
  watermarkApplies: boolean;
  plan: string;
}

export interface LedgerEntry {
  id: string;
  type: TransactionType;
  creditAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface ReferralSummary {
  code: string;
  shareToken: string | null;
  shareTokenExpiresAt: string | null;
  canGenerateToken: boolean;
  totalReferred: number;
  totalRewarded: number;
  creditsEarned: number;
  appliedCode: string | null;
  appliedStatus: ReferralStatus | null;
}

/** Outcome of the step-9 credit gate. */
export interface GenerationGrant {
  watermark: boolean;
  creditsCharged: number;
  balanceAfter: number;
  usedFreeTrial: boolean;
}

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };
