/**
 * Subscription Service for GSTPilot
 * Manages 30-day free trial provisioning, active paid subscriptions, upgrades,
 * downgrades scheduled at renewal, and expiration transitions.
 */

import prisma from "@/lib/prisma";
import {
  FREE_TRIAL_DURATION_DAYS,
  FREE_TRIAL_GSTIN_LIMIT,
  getPlanDefinition,
  isPaidPlan,
  type PlanSlug,
} from "@/features/billing/config/pricing.config";
import { billingLogger } from "@/features/billing/services/billing.logger";

export interface SubscriptionStatusSummary {
  id: string;
  userId: string;
  planSlug: PlanSlug;
  planName: string;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  autoRenew: boolean;
  scheduledPlanSlug: PlanSlug | null;
  monthlyPrice: number;
  includedGSTINs: number;
}

/**
 * Gets or creates the authoritative workspace subscription.
 * Automatically provisions a 30-day free trial with 7 GSTINs for new users.
 */
export async function getOrCreateSubscription(
  userId: string,
  now: Date = new Date()
): Promise<SubscriptionStatusSummary> {
  let sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!sub) {
    const startDate = now;
    const endDate = new Date(startDate.getTime() + FREE_TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

    sub = await prisma.$transaction(async (tx) => {
      const newSub = await tx.subscription.create({
        data: {
          userId,
          planSlug: "free_trial",
          status: "TRIALING",
          startDate,
          endDate,
          autoRenew: false,
        },
      });

      await tx.gSTINCapacity.upsert({
        where: { userId },
        create: {
          userId,
          includedGSTINs: FREE_TRIAL_GSTIN_LIMIT,
          additionalGSTINs: 0,
          usedGSTINs: 0,
          effectiveCapacity: FREE_TRIAL_GSTIN_LIMIT,
        },
        update: {
          includedGSTINs: FREE_TRIAL_GSTIN_LIMIT,
          effectiveCapacity: FREE_TRIAL_GSTIN_LIMIT,
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: newSub.id,
          eventType: "TRIAL_STARTED",
          metadata: {
            durationDays: FREE_TRIAL_DURATION_DAYS,
            gstinLimit: FREE_TRIAL_GSTIN_LIMIT,
          },
        },
      });

      await tx.billingAuditLog.create({
        data: {
          userId,
          action: "TRIAL_PROVISIONED",
          actorId: userId,
          metadata: { planSlug: "free_trial", gstinLimit: FREE_TRIAL_GSTIN_LIMIT },
        },
      });

      return newSub;
    });

    billingLogger.info({ userId, subId: sub.id }, "30-day free trial provisioned with 7 GSTINs");
  }

  // Check for expiration
  const currentSub = sub!;
  let status = currentSub.status as SubscriptionStatusSummary["status"];
  const isExpired = currentSub.endDate < now;

  if (isExpired && status !== "EXPIRED") {
    // If a downgrade was scheduled at renewal, apply it upon expiration
    if (currentSub.scheduledPlanSlug && isPaidPlan(currentSub.scheduledPlanSlug)) {
      const nextPlan = getPlanDefinition(currentSub.scheduledPlanSlug);
      const newStart = now;
      const newEnd = new Date(newStart.getTime() + nextPlan.durationDays * 24 * 60 * 60 * 1000);

      sub = await prisma.$transaction(async (tx) => {
        const updated = await tx.subscription.update({
          where: { id: currentSub.id },
          data: {
            planSlug: nextPlan.slug,
            status: "ACTIVE",
            startDate: newStart,
            endDate: newEnd,
            scheduledPlanSlug: null,
          },
        });

        const cap = await tx.gSTINCapacity.findUnique({ where: { userId } });
        const addOn = cap?.additionalGSTINs ?? 0;
        await tx.gSTINCapacity.update({
          where: { userId },
          data: {
            includedGSTINs: nextPlan.includedGSTINs,
            effectiveCapacity: nextPlan.includedGSTINs + addOn,
          },
        });

        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: currentSub.id,
            eventType: "PLAN_DOWNGRADE_APPLIED",
            metadata: { newPlan: nextPlan.slug },
          },
        });

        return updated;
      });

      status = "ACTIVE";
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: currentSub.id },
          data: { status: "EXPIRED" },
        });

        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: currentSub.id,
            eventType: "EXPIRED",
            metadata: { previousStatus: currentSub.status, expiredAt: now.toISOString() },
          },
        });
      });
      status = "EXPIRED";
    }
  }

  const finalSub = sub!;
  const planDef = getPlanDefinition(finalSub.planSlug);
  const msRemaining = Math.max(0, finalSub.endDate.getTime() - now.getTime());
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const isActive = (status === "ACTIVE" || status === "TRIALING") && !isExpired;
  const isTrial = finalSub.planSlug === "free_trial" || status === "TRIALING";

  return {
    id: finalSub.id,
    userId: finalSub.userId,
    planSlug: planDef.slug,
    planName: planDef.name,
    status,
    isActive,
    isTrial,
    isExpired: !isActive,
    startDate: finalSub.startDate,
    endDate: finalSub.endDate,
    daysRemaining,
    autoRenew: finalSub.autoRenew,
    scheduledPlanSlug: (finalSub.scheduledPlanSlug as PlanSlug) ?? null,
    monthlyPrice: planDef.monthlyPrice,
    includedGSTINs: planDef.includedGSTINs,
  };
}

/**
 * Activates or upgrades a paid subscription plan.
 */
export async function activatePaidPlan(input: {
  userId: string;
  planSlug: PlanSlug;
  paymentId: string;
  providerOrderId?: string;
  amountRupees: number;
}): Promise<SubscriptionStatusSummary> {
  const { userId, planSlug, paymentId, providerOrderId, amountRupees } = input;
  const plan = getPlanDefinition(planSlug);
  const now = new Date();
  const startDate = now;
  const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const updatedSub = await prisma.$transaction(async (tx) => {
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
        paymentType: "SUBSCRIPTION",
        planSlug: plan.slug,
        metadata: {
          planName: plan.name,
          durationDays: plan.durationDays,
          includedGSTINs: plan.includedGSTINs,
        },
      },
    });

    // 2. Upsert subscription
    const sub = await tx.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planSlug: plan.slug,
        status: "ACTIVE",
        startDate,
        endDate,
        autoRenew: true,
        scheduledPlanSlug: null,
      },
      update: {
        planSlug: plan.slug,
        status: "ACTIVE",
        startDate,
        endDate,
        autoRenew: true,
        scheduledPlanSlug: null,
      },
    });

    // 3. Update GSTIN capacity
    const currentCap = await tx.gSTINCapacity.findUnique({ where: { userId } });
    const additional = currentCap?.additionalGSTINs ?? 0;
    const used = await tx.gstinProfile.count({ where: { userId } });

    await tx.gSTINCapacity.upsert({
      where: { userId },
      create: {
        userId,
        includedGSTINs: plan.includedGSTINs,
        additionalGSTINs: additional,
        usedGSTINs: used,
        effectiveCapacity: plan.includedGSTINs + additional,
      },
      update: {
        includedGSTINs: plan.includedGSTINs,
        usedGSTINs: used,
        effectiveCapacity: plan.includedGSTINs + additional,
      },
    });

    // 4. Log event and audit
    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        eventType: "PLAN_ACTIVATED",
        metadata: {
          planSlug: plan.slug,
          paymentId,
          amountRupees,
          includedGSTINs: plan.includedGSTINs,
        },
      },
    });

    await tx.billingAuditLog.create({
      data: {
        userId,
        action: "PLAN_ACTIVATED",
        actorId: userId,
        metadata: {
          planSlug: plan.slug,
          amountRupees,
          paymentId,
        },
      },
    });

    return sub;
  });

  billingLogger.info({ userId, planSlug: plan.slug }, "Paid subscription plan activated successfully");

  return getOrCreateSubscription(userId, now);
}

/**
 * Schedules a plan downgrade for the next billing cycle.
 * Never deletes or revokes access immediately.
 */
export async function scheduleDowngrade(
  userId: string,
  targetPlanSlug: PlanSlug
): Promise<{ success: boolean; message: string }> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) {
    return { success: false, message: "No active subscription found." };
  }

  const targetPlan = getPlanDefinition(targetPlanSlug);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { userId },
      data: { scheduledPlanSlug: targetPlan.slug },
    });

    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        eventType: "DOWNGRADE_SCHEDULED",
        metadata: { scheduledPlanSlug: targetPlan.slug },
      },
    });

    await tx.billingAuditLog.create({
      data: {
        userId,
        action: "DOWNGRADE_SCHEDULED",
        actorId: userId,
        metadata: { scheduledPlanSlug: targetPlan.slug },
      },
    });
  });

  return {
    success: true,
    message: `Your downgrade to ${targetPlan.name} is scheduled for your renewal date.`,
  };
}

/**
 * Cancels auto-renewal of the current subscription.
 */
export async function cancelAutoRenewal(userId: string): Promise<{ success: boolean; message: string }> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return { success: false, message: "No subscription found." };

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { userId },
      data: { autoRenew: false },
    });

    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        eventType: "CANCELLED",
        metadata: { message: "Auto-renew disabled by user" },
      },
    });

    await tx.billingAuditLog.create({
      data: {
        userId,
        action: "AUTO_RENEW_CANCELLED",
        actorId: userId,
      },
    });
  });

  return {
    success: true,
    message: "Auto-renewal cancelled. Your plan remains active until the end of the billing period.",
  };
}
