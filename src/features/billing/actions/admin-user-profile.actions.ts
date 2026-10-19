"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/features/auth";
import prisma from "@/lib/prisma";
import { getPlanDefinition } from "@/features/billing/config/pricing.config";
import { GstinStatus } from "@/features/billing/domain/gstin-capacity";
import { billingLogger } from "@/features/billing/services/billing.logger";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AdminUserProfile {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  role: string;
  createdAt: Date;
  lastActiveAt: Date | null;
  deletedAt: Date | null;
  subscription: {
    planSlug: string;
    planName: string;
    status: string;
    startDate: Date;
    endDate: Date;
    daysRemaining: number;
    autoRenew: boolean;
  } | null;
  gstins: { gstinNumber: string; name: string; status: string; isDefault: boolean }[];
  capacity: { active: number; total: number; included: number; additional: number };
  wallet: {
    balance: number;
    lifetimeRecharged: number;
    lifetimeUsed: number;
    isFrozen: boolean;
  } | null;
  payments: {
    id: string;
    amount: number;
    status: string;
    paymentType: string;
    planSlug: string | null;
    createdAt: Date;
  }[];
  totalPaid: number;
  conversions: number;
  lastConversionAt: Date | null;
  tickets: { id: string; reference: string; subject: string; status: string; createdAt: Date }[];
  audit: { action: string; createdAt: Date; note: string | null }[];
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

const UserIdSchema = z.string().min(1).max(64);

/**
 * Everything an admin needs to know about one account, in one read: who they
 * are and how to reach them, what they pay for and until when, what they use.
 */
export async function adminGetUserProfileAction(userId: string): Promise<Result<AdminUserProfile>> {
  try {
    await requireAdmin();
    const id = UserIdSchema.parse(userId);
    const now = new Date();

    const [u, conversions, lastConversion, paidAgg] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        include: {
          subscription: true,
          gstinCapacity: true,
          wallet: true,
          profiles: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            select: {
              gstinNumber: true,
              legalName: true,
              tradeName: true,
              status: true,
              isDefault: true,
            },
          },
          payments: { orderBy: { createdAt: "desc" }, take: 10 },
          supportTickets: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, reference: true, subject: true, status: true, createdAt: true },
          },
          billingAuditLogs: { orderBy: { createdAt: "desc" }, take: 8 },
        },
      }),
      prisma.conversionHistory.count({ where: { userId: id } }),
      prisma.conversionHistory.findFirst({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.payment.aggregate({
        where: { userId: id, status: { in: ["SUCCESS", "PAID"] } },
        _sum: { amount: true },
      }),
    ]);
    if (!u) return { success: false, error: "User not found." };

    const sub = u.subscription;
    const plan = getPlanDefinition(sub?.planSlug ?? "free_trial");
    const included = u.gstinCapacity?.includedGSTINs ?? plan.includedGSTINs;
    const additional = u.gstinCapacity?.additionalGSTINs ?? 0;

    return {
      success: true,
      data: {
        userId: u.id,
        name: u.name,
        email: u.originalEmail ?? u.email,
        phone: u.phone,
        emailVerified: u.emailVerified,
        role: u.role,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        deletedAt: u.deletedAt,
        subscription: sub
          ? {
              planSlug: plan.slug,
              planName: plan.name,
              status: sub.status,
              startDate: sub.startDate,
              endDate: sub.endDate,
              daysRemaining: Math.max(
                0,
                Math.ceil((sub.endDate.getTime() - now.getTime()) / DAY_MS)
              ),
              autoRenew: sub.autoRenew,
            }
          : null,
        gstins: u.profiles.map((p) => ({
          gstinNumber: p.gstinNumber,
          name: p.tradeName || p.legalName,
          status: p.status,
          isDefault: p.isDefault,
        })),
        capacity: {
          active: u.profiles.filter((p) => p.status === GstinStatus.ACTIVE).length,
          total: included + additional,
          included,
          additional,
        },
        wallet: u.wallet
          ? {
              balance: u.wallet.balance,
              lifetimeRecharged: u.wallet.lifetimeRecharged,
              lifetimeUsed: u.wallet.lifetimeUsed,
              isFrozen: u.wallet.isFrozen,
            }
          : null,
        payments: u.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          paymentType: p.paymentType,
          planSlug: p.planSlug,
          createdAt: p.createdAt,
        })),
        totalPaid: paidAgg._sum.amount ?? 0,
        conversions,
        lastConversionAt: lastConversion?.createdAt ?? null,
        tickets: u.supportTickets,
        audit: u.billingAuditLogs.map((a) => {
          const meta = (a.metadata ?? {}) as Record<string, unknown>;
          return {
            action: a.action,
            createdAt: a.createdAt,
            note: typeof meta.note === "string" && meta.note ? meta.note : null,
          };
        }),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load the user's profile.",
    };
  }
}

const AdjustValiditySchema = z.object({
  userId: UserIdSchema,
  days: z
    .number()
    .int()
    .min(-3650)
    .max(3650)
    .refine((d) => d !== 0, "Enter a number of days other than 0."),
  note: z.string().max(300).optional(),
});

/**
 * Moves the end of a user's current plan by a number of days, either way.
 *
 * Extending a lapsed plan counts from today, so +30 always buys thirty usable
 * days. Taking away more days than remain ends the plan now and marks it
 * expired; it never leaves an "active" plan dated in the past.
 */
export async function adminAdjustValidityAction(
  input: z.input<typeof AdjustValiditySchema>
): Promise<Result<{ endDate: Date; status: string }>> {
  try {
    const admin = await requireAdmin();
    const { userId, days, note } = AdjustValiditySchema.parse(input);

    const outcome = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { userId } });
      if (!sub) throw new Error("This user has no subscription yet.");

      const now = new Date();
      const base = days > 0 && sub.endDate < now ? now : sub.endDate;
      let endDate = new Date(base.getTime() + days * DAY_MS);
      let status = sub.status;
      if (endDate <= now) {
        endDate = now;
        status = "EXPIRED";
      } else if (status === "EXPIRED" || status === "CANCELLED") {
        status = sub.planSlug === "free_trial" ? "TRIALING" : "ACTIVE";
      }

      await tx.subscription.update({
        where: { userId },
        data: { endDate, status, currentPeriodEnd: endDate },
      });
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          eventType: days > 0 ? "ADMIN_DURATION_EXTENDED" : "ADMIN_DURATION_REDUCED",
          metadata: {
            adminId: admin.user.id,
            days,
            previousEndDate: sub.endDate.toISOString(),
            newEndDate: endDate.toISOString(),
            note: note || null,
          },
        },
      });
      await tx.billingAuditLog.create({
        data: {
          userId,
          actorId: admin.user.id,
          action: days > 0 ? "ADMIN_EXTEND_SUBSCRIPTION" : "ADMIN_REDUCE_SUBSCRIPTION",
          metadata: { days, newEndDate: endDate.toISOString(), note: note || null },
        },
      });
      return { endDate, status };
    });

    billingLogger.info(
      { adminId: admin.user.id, targetUserId: userId, days },
      "Admin changed plan validity"
    );
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { success: true, data: outcome };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? "Invalid input.")
          : err instanceof Error
            ? err.message
            : "Failed to change the plan's validity.",
    };
  }
}
