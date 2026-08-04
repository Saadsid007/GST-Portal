import { z } from "zod";
import {
  CA_PLAN_IDS,
  MAX_RECHARGE_AMOUNT,
  MIN_RECHARGE_AMOUNT,
  TRANSACTION_TYPES,
} from "@/features/billing/constants/billing.constants";

export const rechargeSchema = z.object({
  amount: z
    .number()
    .int("Recharge amount must be a whole rupee value")
    .min(MIN_RECHARGE_AMOUNT, `Minimum recharge is ₹${MIN_RECHARGE_AMOUNT}`)
    .max(MAX_RECHARGE_AMOUNT, `Maximum recharge is ₹${MAX_RECHARGE_AMOUNT}`),
});

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

/** Referral and credit codes are normalised to trimmed uppercase before lookup. */
const codeField = z
  .string()
  .trim()
  .min(4, "Code is too short")
  .max(32, "Code is too long")
  .transform((value) => value.toUpperCase());

export const applyReferralSchema = z.object({ code: codeField });
export const redeemCreditCodeSchema = z.object({ code: codeField });

export const bonusSlabSchema = z.object({
  minAmount: z.number().int().min(1),
  maxAmount: z.number().int().min(1).nullable(),
  bonusPercent: z.number().min(0).max(100),
});

/**
 * The whole slab table is validated as a unit: ascending, contiguous and
 * non-overlapping, with exactly one open-ended top slab. A malformed table
 * would silently mis-price every recharge, so it is rejected on save.
 */
export const bonusSlabsSchema = z
  .array(bonusSlabSchema)
  .min(1, "At least one slab is required")
  .superRefine((slabs, ctx) => {
    for (let i = 0; i < slabs.length; i += 1) {
      const slab = slabs[i];
      if (!slab) continue;
      const isLast = i === slabs.length - 1;

      if (!isLast && slab.maxAmount === null) {
        ctx.addIssue({
          code: "custom",
          message: "Only the final slab may be open-ended",
          path: [i, "maxAmount"],
        });
        continue;
      }
      if (slab.maxAmount !== null && slab.maxAmount < slab.minAmount) {
        ctx.addIssue({
          code: "custom",
          message: "Slab maximum cannot be below its minimum",
          path: [i, "maxAmount"],
        });
        continue;
      }

      const next = slabs[i + 1];
      if (next && slab.maxAmount !== null && next.minAmount !== slab.maxAmount + 1) {
        ctx.addIssue({
          code: "custom",
          message: `Slab must start at ₹${slab.maxAmount + 1} to leave no gap or overlap`,
          path: [i + 1, "minAmount"],
        });
      }
    }

    if (slabs.at(-1)?.maxAmount !== null) {
      ctx.addIssue({
        code: "custom",
        message: "The highest slab must be open-ended (no maximum)",
        path: [slabs.length - 1, "maxAmount"],
      });
    }
  });

export const rechargePacksSchema = z
  .array(
    z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      amount: z.number().int().min(MIN_RECHARGE_AMOUNT).max(MAX_RECHARGE_AMOUNT),
      popular: z.boolean(),
    })
  )
  .min(1, "At least one recharge pack is required");

export const generationCostSchema = z.object({
  cost: z.number().int().min(1, "Generation cost must be at least 1 credit").max(1000),
});

export const referralRewardsSchema = z.object({
  referrerCredits: z.number().int().min(0).max(10_000),
  refereeCredits: z.number().int().min(0).max(10_000),
});

export const freeTrialSchema = z.object({
  maxGstins: z.number().int().min(0).max(100),
  maxGenerations: z.number().int().min(0).max(100),
  watermark: z.boolean(),
});

export const campaignSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  isActive: z.boolean(),
  bonusMultiplier: z.number().min(0).max(10),
  extraBonusPercent: z.number().min(0).max(100),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
});

export const adminCreditSchema = z.object({
  userId: z.string().min(1, "User is required"),
  credits: z
    .number()
    .int("Credits must be a whole number")
    .refine((value) => value !== 0, "Credits cannot be zero")
    .refine((value) => Math.abs(value) <= 100_000, "Credits must be within ±100,000"),
  reason: z.string().trim().min(3, "A reason is required for the audit trail").max(500),
});

export const freezeWalletSchema = z.object({
  userId: z.string().min(1),
  isFrozen: z.boolean(),
  reason: z.string().trim().min(3, "A reason is required for the audit trail").max(500),
});

export const createCreditCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, "Code must be at least 4 characters")
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, "Only letters, numbers and hyphens are allowed")
    .transform((value) => value.toUpperCase()),
  credits: z
    .number()
    .int("Credits must be a whole number")
    .min(1, "Credits must be at least 1")
    .max(100_000),
  maxRedemptions: z
    .number()
    .int()
    .min(1, "The code must be valid for at least 1 user")
    .max(100_000),
  expiresAt: z.string().nullable(),
  note: z.string().trim().max(200).optional(),
});

export const setPlanSchema = z.object({
  userId: z.string().min(1),
  plan: z.enum(CA_PLAN_IDS),
  monthsValid: z.number().int().min(1).max(120).nullable(),
});

export const ledgerQuerySchema = z.object({
  type: z.enum(TRANSACTION_TYPES).nullable().default(null),
  limit: z.number().int().min(1).max(500).default(100),
});
