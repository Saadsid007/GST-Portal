"use server";

import { requireSession } from "@/features/auth";
import {
  getAllPlans,
  getPlanDefinition,
  type PlanSlug,
} from "@/features/billing/config/pricing.config";
import {
  addGstinCapacity,
  calculateGstinAddonProration,
  canCreateGstin,
  getGstinCapacity,
  type GSTINCapacityStatus,
  type ProrationCalculation,
} from "@/features/billing/services/capacity.service";
import {
  getWorkspaceEntitlements,
  type WorkspaceEntitlements,
} from "@/features/billing/services/entitlement.service";
import {
  createRazorpayOrder,
  verifyCheckoutSignature,
  type CreatedOrder,
} from "@/features/billing/services/razorpay.service";
import {
  activatePaidPlan,
  cancelAutoRenewal,
  getOrCreateSubscription,
  scheduleDowngrade,
  type SubscriptionStatusSummary,
} from "@/features/billing/services/subscription.service";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface BillingOverview {
  subscription: SubscriptionStatusSummary;
  capacity: GSTINCapacityStatus;
  entitlements: WorkspaceEntitlements;
  plans: ReturnType<typeof getAllPlans>;
  paymentHistory: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    paymentType: string;
    planSlug: string | null;
    providerPaymentId: string | null;
    createdAt: Date;
  }[];
}

/**
 * Gets the complete workspace billing overview for the dashboard.
 */
export async function getBillingOverviewAction(): Promise<{
  success: boolean;
  data?: BillingOverview;
  error?: string;
}> {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const [subscription, capacity, entitlements, payments] = await Promise.all([
      getOrCreateSubscription(userId),
      getGstinCapacity(userId),
      getWorkspaceEntitlements(userId),
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return {
      success: true,
      data: {
        subscription,
        capacity,
        entitlements,
        plans: getAllPlans(),
        paymentHistory: payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          paymentType: p.paymentType,
          planSlug: p.planSlug,
          providerPaymentId: p.providerPaymentId,
          createdAt: p.createdAt,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load billing overview.",
    };
  }
}

/**
 * Creates a Razorpay order for subscribing to or upgrading a plan.
 */
export async function createPlanSubscriptionOrderAction(planSlug: PlanSlug): Promise<{
  success: boolean;
  data?: CreatedOrder & { planSlug: PlanSlug; planName: string };
  error?: string;
}> {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const plan = getPlanDefinition(planSlug);

    if (plan.monthlyPrice <= 0) {
      return { success: false, error: "Free trial cannot be purchased with payment." };
    }

    const receipt = `sub_${Date.now().toString(36)}`;
    const order = await createRazorpayOrder(plan.monthlyPrice, receipt, {
      userId,
      planSlug: plan.slug,
      type: "SUBSCRIPTION",
    });

    return {
      success: true,
      data: {
        ...order,
        planSlug: plan.slug,
        planName: plan.name,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create subscription order.",
    };
  }
}

/**
 * Creates a Razorpay order for purchasing prorated additional GSTIN slots.
 */
export async function createGstinAddonOrderAction(quantity: number): Promise<{
  success: boolean;
  data?: CreatedOrder & { proration: ProrationCalculation };
  error?: string;
}> {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (quantity < 1) {
      return { success: false, error: "Minimum 1 additional GSTIN required." };
    }

    const proration = await calculateGstinAddonProration(userId, quantity);
    const receipt = `addon_${Date.now().toString(36)}`;
    const order = await createRazorpayOrder(proration.proratedAmount, receipt, {
      userId,
      quantity: String(quantity),
      type: "ADDITIONAL_GSTIN",
    });

    return {
      success: true,
      data: {
        ...order,
        proration,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create GSTIN add-on order.",
    };
  }
}

/**
 * Verifies Razorpay checkout signature and activates plan immediately.
 */
export async function confirmPlanPaymentAction(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  planSlug: PlanSlug;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const valid = verifyCheckoutSignature({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
    });

    if (!valid) {
      return { success: false, error: "Invalid payment signature." };
    }

    const plan = getPlanDefinition(input.planSlug);
    await activatePaidPlan({
      userId,
      planSlug: input.planSlug,
      paymentId: input.paymentId,
      providerOrderId: input.orderId,
      amountRupees: plan.monthlyPrice,
    });

    revalidatePath("/billing");
    revalidatePath("/convert");
    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Payment confirmation failed.",
    };
  }
}

/**
 * Verifies Razorpay checkout signature and adds GSTIN capacity immediately.
 */
export async function confirmGstinAddonPaymentAction(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  quantity: number;
  amountRupees: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const valid = verifyCheckoutSignature({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
    });

    if (!valid) {
      return { success: false, error: "Invalid payment signature." };
    }

    await addGstinCapacity({
      userId,
      quantity: input.quantity,
      amountRupees: input.amountRupees,
      paymentId: input.paymentId,
      providerOrderId: input.orderId,
    });

    revalidatePath("/billing");
    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "GSTIN add-on confirmation failed.",
    };
  }
}

/**
 * Schedules a plan downgrade at renewal.
 */
export async function scheduleDowngradeAction(targetPlanSlug: PlanSlug): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await requireSession();
    const res = await scheduleDowngrade(session.user.id, targetPlanSlug);
    revalidatePath("/billing");
    return { success: res.success, message: res.message };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to schedule downgrade.",
    };
  }
}

/**
 * Cancels auto-renewal of subscription.
 */
export async function cancelAutoRenewalAction(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await requireSession();
    const res = await cancelAutoRenewal(session.user.id);
    revalidatePath("/billing");
    return { success: res.success, message: res.message };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel auto-renewal.",
    };
  }
}

/**
 * Previews prorated cost for add-on GSTINs.
 */
export async function calculateGstinProrationAction(quantity: number): Promise<{
  success: boolean;
  data?: ProrationCalculation;
  error?: string;
}> {
  try {
    const session = await requireSession();
    const proration = await calculateGstinAddonProration(session.user.id, quantity);
    return { success: true, data: proration };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Calculation failed.",
    };
  }
}

/**
 * Checks if user can create another GSTIN profile.
 */
export async function checkCanCreateGstinAction(): Promise<{
  allowed: boolean;
  reason?: string;
  capacity?: GSTINCapacityStatus;
}> {
  const session = await requireSession();
  const res = await canCreateGstin(session.user.id);
  if (!res.allowed) {
    return { allowed: false, reason: res.reason, capacity: res.capacity };
  }
  return { allowed: true };
}
