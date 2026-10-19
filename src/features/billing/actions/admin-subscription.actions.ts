"use server";

import { requireAdmin } from "@/features/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  getPlanDefinition,
  isPaidPlan,
  type PlanSlug,
} from "@/features/billing/config/pricing.config";
import { billingLogger } from "@/features/billing/services/billing.logger";
import { GstinStatus } from "@/features/billing/domain/gstin-capacity";
import { revalidatePath } from "next/cache";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(end: Date, now: Date): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

export interface AdminSubscriberItem {
  userId: string;
  userName: string;
  userEmail: string;
  phone: string | null;
  emailVerified: boolean;
  role: string;
  deleted: boolean;
  planSlug: PlanSlug;
  planName: string;
  status: string;
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  autoRenew: boolean;
  scheduledPlanSlug: PlanSlug | null;
  includedGSTINs: number;
  additionalGSTINs: number;
  usedGSTINs: number;
  totalCapacity: number;
  usagePercent: number;
  totalPaid: number;
  /** Last authenticated request; null for an account not seen since tracking began. */
  lastActive: Date | null;
  createdAt: Date;
}

export interface AdminBillingStats {
  totalUsers: number;
  activeSubscribers: number;
  trialUsers: number;
  expiredUsers: number;
  totalGstinSlotsAllocated: number;
  totalGstinProfilesUsed: number;
  totalRevenueRupees: number;
  mrrEstimateRupees: number;
}

/**
 * Fetch high-level platform billing metrics for admin overview.
 */
export async function adminGetBillingStatsAction(): Promise<{
  success: boolean;
  data?: AdminBillingStats;
  error?: string;
}> {
  try {
    await requireAdmin();

    const [
      totalUsers,
      activeSubs,
      trialSubs,
      expiredSubs,
      capacityAgg,
      usedGstinsCount,
      paymentsAgg,
      activePaidSubs,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.subscription.count({ where: { status: "ACTIVE", user: { deletedAt: null } } }),
      prisma.subscription.count({ where: { status: "TRIALING", user: { deletedAt: null } } }),
      prisma.subscription.count({ where: { status: "EXPIRED", user: { deletedAt: null } } }),
      prisma.gSTINCapacity.aggregate({
        _sum: { effectiveCapacity: true },
      }),
      prisma.gstinProfile.count({
        where: { status: GstinStatus.ACTIVE, user: { deletedAt: null } },
      }),
      prisma.payment.aggregate({
        where: { status: { in: ["SUCCESS", "PAID"] } },
        _sum: { amount: true },
      }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE", user: { deletedAt: null } },
        select: { planSlug: true },
      }),
    ]);

    let mrrEstimate = 0;
    for (const sub of activePaidSubs) {
      if (isPaidPlan(sub.planSlug)) {
        const p = getPlanDefinition(sub.planSlug);
        mrrEstimate += p.monthlyPrice;
      }
    }

    return {
      success: true,
      data: {
        totalUsers,
        activeSubscribers: activeSubs,
        trialUsers: trialSubs,
        expiredUsers: expiredSubs,
        totalGstinSlotsAllocated: capacityAgg._sum.effectiveCapacity ?? 0,
        totalGstinProfilesUsed: usedGstinsCount,
        totalRevenueRupees: paymentsAgg._sum.amount ?? 0,
        mrrEstimateRupees: mrrEstimate,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch admin billing stats.",
    };
  }
}

/**
 * Fetch paginated subscriber list with capacity usage and payment totals.
 */
export async function adminGetSubscribersListAction(params: {
  search?: string;
  planSlug?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: {
    items: AdminSubscriberItem[];
    total: number;
    page: number;
    totalPages: number;
  };
  error?: string;
}> {
  try {
    await requireAdmin();

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(5, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;

    // Deleted accounts are kept for the record but left out of the working
    // list; the "Deleted" filter is the one place they show.
    const showDeleted = params.status === "DELETED";
    const whereUser: Prisma.UserWhereInput = {
      deletedAt: showDeleted ? { not: null } : null,
    };
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      const digits = q.replace(/\D/g, "");
      whereUser.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { originalEmail: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      ];
    }

    const whereSub: Prisma.SubscriptionWhereInput = {};
    if (params.planSlug && params.planSlug !== "ALL") {
      whereSub.planSlug = params.planSlug;
    }
    if (params.status && params.status !== "ALL" && !showDeleted) {
      whereSub.status = params.status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          ...whereUser,
          subscription: Object.keys(whereSub).length > 0 ? whereSub : undefined,
        },
        include: {
          subscription: true,
          gstinCapacity: true,
          profiles: { where: { status: GstinStatus.ACTIVE }, select: { id: true } },
          payments: {
            where: { status: { in: ["SUCCESS", "PAID"] } },
            select: { amount: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({
        where: {
          ...whereUser,
          subscription: Object.keys(whereSub).length > 0 ? whereSub : undefined,
        },
      }),
    ]);

    const now = new Date();

    const items: AdminSubscriberItem[] = users.map((u) => {
      const sub = u.subscription;
      const cap = u.gstinCapacity;
      const planDef = getPlanDefinition(sub?.planSlug ?? "free_trial");
      const included = cap?.includedGSTINs ?? planDef.includedGSTINs;
      const additional = cap?.additionalGSTINs ?? 0;
      const totalCap = included + additional;
      const used = u.profiles.length;
      const usagePercent = totalCap > 0 ? Math.min(100, Math.round((used / totalCap) * 100)) : 0;

      const endDate = sub?.endDate ?? now;
      const daysRemaining = daysUntil(endDate, now);

      const totalPaid = u.payments.reduce((sum, p) => sum + p.amount, 0);

      return {
        userId: u.id,
        userName: u.name || "Unnamed User",
        userEmail: u.originalEmail ?? u.email,
        phone: u.phone,
        emailVerified: u.emailVerified,
        role: u.role,
        deleted: u.deletedAt !== null,
        planSlug: planDef.slug,
        planName: planDef.name,
        status: sub?.status ?? "TRIALING",
        startDate: sub?.startDate ?? now,
        endDate,
        daysRemaining,
        autoRenew: sub?.autoRenew ?? false,
        scheduledPlanSlug: (sub?.scheduledPlanSlug as PlanSlug) ?? null,
        includedGSTINs: included,
        additionalGSTINs: additional,
        usedGSTINs: used,
        totalCapacity: totalCap,
        usagePercent,
        totalPaid,
        // This read updatedAt, which moves when a profile is edited, not when
        // the person uses the product.
        lastActive: u.lastActiveAt,
        createdAt: u.createdAt,
      };
    });

    return {
      success: true,
      data: {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load subscribers list.",
    };
  }
}

/**
 * Admin override: Change or assign a user's subscription plan directly.
 */
export async function adminChangeUserPlanAction(input: {
  userId: string;
  planSlug: PlanSlug;
  durationDays?: number;
  status?: string;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const { userId, planSlug, durationDays = 30, status = "ACTIVE", note } = input;

    const planDef = getPlanDefinition(planSlug);
    const now = new Date();
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Upsert subscription
      const sub = await tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          planSlug: planDef.slug,
          status,
          startDate: now,
          endDate,
          autoRenew: false,
        },
        update: {
          planSlug: planDef.slug,
          status,
          startDate: now,
          endDate,
          scheduledPlanSlug: null,
        },
      });

      // Update capacity
      const existingCap = await tx.gSTINCapacity.findUnique({ where: { userId } });
      const addOn = existingCap?.additionalGSTINs ?? 0;
      const profileCount = await tx.gstinProfile.count({
        where: { userId, status: GstinStatus.ACTIVE },
      });

      await tx.gSTINCapacity.upsert({
        where: { userId },
        create: {
          userId,
          includedGSTINs: planDef.includedGSTINs,
          additionalGSTINs: addOn,
          usedGSTINs: profileCount,
          effectiveCapacity: planDef.includedGSTINs + addOn,
        },
        update: {
          includedGSTINs: planDef.includedGSTINs,
          usedGSTINs: profileCount,
          effectiveCapacity: planDef.includedGSTINs + addOn,
        },
      });

      // Audit logs
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          eventType: "ADMIN_PLAN_OVERRIDE",
          metadata: {
            adminId: admin.user.id,
            planSlug: planDef.slug,
            durationDays,
            note: note || "Admin changed plan",
          },
        },
      });

      await tx.billingAuditLog.create({
        data: {
          userId,
          actorId: admin.user.id,
          action: "ADMIN_CHANGE_PLAN",
          metadata: {
            newPlan: planDef.slug,
            durationDays,
            note,
          },
        },
      });
    });

    billingLogger.info(
      { adminId: admin.user.id, targetUserId: userId, newPlan: planDef.slug },
      "Admin overridden user plan successfully"
    );

    revalidatePath("/billing");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to change user plan.",
    };
  }
}

/**
 * Admin action: Grant or adjust extra GSTIN capacity for a user.
 */
export async function adminAdjustGstinCapacityAction(input: {
  userId: string;
  additionalGstins: number; // can be positive or negative
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const { userId, additionalGstins, note } = input;

    await prisma.$transaction(async (tx) => {
      const cap = await tx.gSTINCapacity.findUnique({ where: { userId } });
      const currentAdditional = cap?.additionalGSTINs ?? 0;
      const included = cap?.includedGSTINs ?? 7;
      const newAdditional = Math.max(0, currentAdditional + additionalGstins);
      const profileCount = await tx.gstinProfile.count({
        where: { userId, status: GstinStatus.ACTIVE },
      });

      await tx.gSTINCapacity.upsert({
        where: { userId },
        create: {
          userId,
          includedGSTINs: included,
          additionalGSTINs: newAdditional,
          usedGSTINs: profileCount,
          effectiveCapacity: included + newAdditional,
        },
        update: {
          additionalGSTINs: newAdditional,
          usedGSTINs: profileCount,
          effectiveCapacity: included + newAdditional,
        },
      });

      await tx.billingAuditLog.create({
        data: {
          userId,
          actorId: admin.user.id,
          action: "ADMIN_ADJUST_CAPACITY",
          metadata: {
            change: additionalGstins,
            previousAdditional: currentAdditional,
            newAdditional,
            note: note || "Admin manual capacity adjustment",
          },
        },
      });
    });

    revalidatePath("/billing");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to adjust GSTIN capacity.",
    };
  }
}

/**
 * Admin action: Reset a user to a fresh 30-day Free Trial (7 GSTIN capacity).
 */
export async function adminResetTrialAction(input: {
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const { userId } = input;

    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          planSlug: "free_trial",
          status: "TRIALING",
          startDate: now,
          endDate,
          autoRenew: false,
        },
        update: {
          planSlug: "free_trial",
          status: "TRIALING",
          startDate: now,
          endDate,
          scheduledPlanSlug: null,
        },
      });

      const profileCount = await tx.gstinProfile.count({
        where: { userId, status: GstinStatus.ACTIVE },
      });
      await tx.gSTINCapacity.upsert({
        where: { userId },
        create: {
          userId,
          includedGSTINs: 7,
          additionalGSTINs: 0,
          usedGSTINs: profileCount,
          effectiveCapacity: 7,
        },
        update: {
          includedGSTINs: 7,
          usedGSTINs: profileCount,
          effectiveCapacity: 7,
        },
      });

      await tx.billingAuditLog.create({
        data: {
          userId,
          actorId: admin.user.id,
          action: "ADMIN_RESET_TRIAL",
          metadata: { durationDays: 30, gstinLimit: 7 },
        },
      });
    });

    revalidatePath("/billing");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reset trial.",
    };
  }
}
