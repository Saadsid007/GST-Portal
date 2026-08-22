/**
 * GSTIN Capacity Service for GSTPilot
 * Enforces client GSTIN slot limits, usage monitoring, and server-side
 * proration calculations for add-on GSTIN purchases.
 */

import prisma from "@/lib/prisma";
import {
  ADDITIONAL_GSTIN_PRICE_MONTHLY,
  MIN_GSTIN_ADDON_PACK,
} from "@/features/billing/config/pricing.config";
import { getOrCreateSubscription } from "@/features/billing/services/subscription.service";
import { billingLogger } from "@/features/billing/services/billing.logger";

export interface GSTINCapacityStatus {
  userId: string;
  included: number;
  additional: number;
  totalCapacity: number;
  used: number;
  available: number;
  usagePercent: number;
  status: "OK" | "WARNING_80" | "WARNING_90" | "LIMIT_REACHED";
  canAddMore: boolean;
  planName: string;
  planSlug: string;
}

export interface ProrationCalculation {
  quantity: number;
  pricePerGSTIN: number;
  fullMonthlyAmount: number;
  proratedAmount: number;
  remainingDays: number;
  totalCycleDays: number;
  cycleEndDate: Date;
}

/**
 * Gets real-time GSTIN capacity and usage statistics for a workspace.
 */
export async function getGstinCapacity(
  userId: string,
  now: Date = new Date()
): Promise<GSTINCapacityStatus> {
  const [sub, actualUsedCount] = await Promise.all([
    getOrCreateSubscription(userId, now),
    prisma.gstinProfile.count({ where: { userId } }),
  ]);

  let cap = await prisma.gSTINCapacity.findUnique({ where: { userId } });

  if (!cap) {
    cap = await prisma.gSTINCapacity.create({
      data: {
        userId,
        includedGSTINs: sub.includedGSTINs,
        additionalGSTINs: 0,
        usedGSTINs: actualUsedCount,
        effectiveCapacity: sub.includedGSTINs,
      },
    });
  } else if (cap.usedGSTINs !== actualUsedCount || cap.includedGSTINs !== sub.includedGSTINs) {
    cap = await prisma.gSTINCapacity.update({
      where: { userId },
      data: {
        includedGSTINs: sub.includedGSTINs,
        usedGSTINs: actualUsedCount,
        effectiveCapacity: sub.includedGSTINs + cap.additionalGSTINs,
      },
    });
  }

  const included = cap.includedGSTINs;
  const additional = cap.additionalGSTINs;
  const totalCapacity = included + additional;
  const used = actualUsedCount;
  const available = Math.max(0, totalCapacity - used);
  const usagePercent = totalCapacity > 0 ? Math.min(100, Math.round((used / totalCapacity) * 100)) : 100;

  let status: GSTINCapacityStatus["status"] = "OK";
  if (used >= totalCapacity) {
    status = "LIMIT_REACHED";
  } else if (usagePercent >= 90) {
    status = "WARNING_90";
  } else if (usagePercent >= 80) {
    status = "WARNING_80";
  }

  const canAddMore = sub.isActive && used < totalCapacity;

  return {
    userId,
    included,
    additional,
    totalCapacity,
    used,
    available,
    usagePercent,
    status,
    canAddMore,
    planName: sub.planName,
    planSlug: sub.planSlug,
  };
}

/**
 * Authoritative server-side gate before creating a new GSTIN profile.
 */
export async function canCreateGstin(
  userId: string
): Promise<{ allowed: true } | { allowed: false; reason: string; capacity: GSTINCapacityStatus }> {
  const capacity = await getGstinCapacity(userId);
  const sub = await getOrCreateSubscription(userId);

  if (sub.isExpired) {
    return {
      allowed: false,
      reason: "Your subscription / 30-day free trial has expired. Please upgrade or renew your plan to add more GSTIN profiles.",
      capacity,
    };
  }

  if (capacity.used >= capacity.totalCapacity) {
    return {
      allowed: false,
      reason: `GSTIN limit reached (${capacity.used} of ${capacity.totalCapacity} slots used). Please upgrade your plan or add additional GSTIN capacity.`,
      capacity,
    };
  }

  return { allowed: true };
}

/**
 * Calculates server-side prorated charges for additional GSTIN capacity.
 * Prorates based on the exact remaining days in the user's active billing cycle.
 */
export async function calculateGstinAddonProration(
  userId: string,
  quantity: number,
  now: Date = new Date()
): Promise<ProrationCalculation> {
  const qty = Math.max(MIN_GSTIN_ADDON_PACK, Math.floor(quantity));
  const sub = await getOrCreateSubscription(userId, now);

  const totalCycleDays = Math.max(
    1,
    Math.round((sub.endDate.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const msRemaining = Math.max(0, sub.endDate.getTime() - now.getTime());
  const remainingDays = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  const fullMonthlyAmount = qty * ADDITIONAL_GSTIN_PRICE_MONTHLY;
  const fractionRemaining = Math.min(1, Math.max(0, remainingDays / totalCycleDays));

  // Prorated amount in whole rupees (ceil ensures at least ₹1)
  const proratedAmount = Math.max(1, Math.ceil(fullMonthlyAmount * fractionRemaining));

  return {
    quantity: qty,
    pricePerGSTIN: ADDITIONAL_GSTIN_PRICE_MONTHLY,
    fullMonthlyAmount,
    proratedAmount,
    remainingDays,
    totalCycleDays,
    cycleEndDate: sub.endDate,
  };
}

/**
 * Purchases additional GSTIN capacity and activates it immediately.
 */
export async function addGstinCapacity(input: {
  userId: string;
  quantity: number;
  amountRupees: number;
  paymentId: string;
  providerOrderId?: string;
}): Promise<GSTINCapacityStatus> {
  const { userId, quantity, amountRupees, paymentId, providerOrderId } = input;
  const now = new Date();
  const sub = await getOrCreateSubscription(userId, now);

  await prisma.$transaction(async (tx) => {
    // 1. Record payment
    await tx.payment.create({
      data: {
        userId,
        provider: "RAZORPAY",
        providerOrderId: providerOrderId ?? null,
        providerPaymentId: paymentId,
        amount: amountRupees,
        currency: "INR",
        status: "SUCCESS",
        paymentType: "ADDITIONAL_GSTIN",
        planSlug: sub.planSlug,
        metadata: {
          quantity,
          pricePerGSTIN: ADDITIONAL_GSTIN_PRICE_MONTHLY,
          cycleEndDate: sub.endDate.toISOString(),
        },
      },
    });

    // 2. Record purchase ledger
    await tx.additionalGSTINPurchase.create({
      data: {
        userId,
        quantity,
        pricePerGSTIN: ADDITIONAL_GSTIN_PRICE_MONTHLY,
        amount: amountRupees,
        startDate: now,
        endDate: sub.endDate,
        providerPaymentId: paymentId,
      },
    });

    // 3. Update materialised capacity
    const cap = await tx.gSTINCapacity.findUnique({ where: { userId } });
    const currentAddon = cap?.additionalGSTINs ?? 0;
    const newAddon = currentAddon + quantity;
    const included = cap?.includedGSTINs ?? sub.includedGSTINs;

    await tx.gSTINCapacity.upsert({
      where: { userId },
      create: {
        userId,
        includedGSTINs: included,
        additionalGSTINs: newAddon,
        usedGSTINs: cap?.usedGSTINs ?? 0,
        effectiveCapacity: included + newAddon,
      },
      update: {
        additionalGSTINs: newAddon,
        effectiveCapacity: included + newAddon,
      },
    });

    // 4. Log audit
    await tx.billingAuditLog.create({
      data: {
        userId,
        action: "ADDITIONAL_GSTIN_PURCHASED",
        actorId: userId,
        metadata: {
          quantity,
          amountRupees,
          paymentId,
          newTotalCapacity: included + newAddon,
        },
      },
    });
  });

  billingLogger.info(
    { userId, addedQty: quantity, amountRupees },
    "Additional GSTIN capacity purchased and activated"
  );

  // Send payment receipt email in background
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      const { EmailService } = await import("@/features/email/services/email.service");
      void EmailService.sendPaymentReceiptEmail({
        to: user.email,
        name: user.name,
        orderId: providerOrderId || `addon_${Date.now().toString(36)}`,
        paymentId,
        amountRupees,
        planName: `Extra GSTIN Capacity (+${quantity} slots)`,
        gstinSlots: quantity,
      });
    }
  } catch (err) {
    billingLogger.error({ error: err }, "Failed to send additional GSTIN receipt email");
  }

  return getGstinCapacity(userId, now);
}
