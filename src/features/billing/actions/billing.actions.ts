"use server";

import { requireSession } from "@/features/auth";
import {
  getAllPlans,
  getPlanDefinition,
  isPurchasable,
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

    // Server-side gate: hiding the button is presentation, not enforcement.
    if (!isPurchasable(plan.slug)) {
      return {
        success: false,
        error:
          plan.comingSoon === true
            ? `${plan.name} is not available yet. Contact us to join the early-access list.`
            : "This plan cannot be purchased.",
      };
    }

    const receipt = `sub_${Date.now().toString(36)}`;
    const order = await createRazorpayOrder(plan.monthlyPrice, receipt, {
      userId,
      planSlug: plan.slug,
      type: "SUBSCRIPTION",
    });

    // Persist what was actually ordered, owned by this user. Confirmation reads
    // the plan and price back from here — never from the client, which would
    // otherwise be free to pay for Starter and claim CA Firm.
    await prisma.payment.create({
      data: {
        userId,
        provider: "RAZORPAY",
        providerOrderId: order.orderId,
        amount: plan.monthlyPrice,
        currency: "INR",
        status: "CREATED",
        paymentType: "SUBSCRIPTION",
        planSlug: plan.slug,
        metadata: { receipt, planName: plan.name },
      },
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
      quantity: String(proration.quantity),
      type: "ADDITIONAL_GSTIN",
    });

    // Quantity and price are recorded server-side against this order, so
    // confirmation cannot be replayed with a larger quantity than was paid for.
    await prisma.payment.create({
      data: {
        userId,
        provider: "RAZORPAY",
        providerOrderId: order.orderId,
        amount: proration.proratedAmount,
        currency: "INR",
        status: "CREATED",
        paymentType: "ADDITIONAL_GSTIN",
        metadata: { receipt, quantity: proration.quantity },
      },
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
 * Loads the pending order this user actually placed.
 *
 * The checkout signature is an HMAC over `orderId|paymentId` only — it proves a
 * payment happened against that order, but it binds neither the plan, the
 * quantity nor the amount. Confirmation must therefore read what was ordered
 * from our own record, scoped to the caller, and ignore the client entirely.
 */
async function claimPendingOrder(input: {
  userId: string;
  orderId: string;
  paymentId: string;
  signature: string;
  paymentType: "SUBSCRIPTION" | "ADDITIONAL_GSTIN";
}): Promise<
  | { ok: true; order: { amount: number; planSlug: string | null; metadata: unknown } }
  | { ok: false; error: string }
> {
  const valid = verifyCheckoutSignature({
    orderId: input.orderId,
    paymentId: input.paymentId,
    signature: input.signature,
  });
  if (!valid) return { ok: false, error: "Invalid payment signature." };

  const order = await prisma.payment.findUnique({
    where: { providerOrderId: input.orderId },
  });

  // Scoped to the caller: an order belonging to someone else is not theirs to
  // redeem, even with a valid signature for it.
  if (!order || order.userId !== input.userId || order.paymentType !== input.paymentType) {
    return { ok: false, error: "Order not found for this account." };
  }

  if (order.status === "SUCCESS") {
    return { ok: false, error: "This payment has already been applied." };
  }

  return {
    ok: true,
    order: { amount: order.amount, planSlug: order.planSlug, metadata: order.metadata },
  };
}

/**
 * Verifies Razorpay checkout signature and activates the plan that was ordered.
 */
export async function confirmPlanPaymentAction(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const claim = await claimPendingOrder({
      userId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
      paymentType: "SUBSCRIPTION",
    });
    if (!claim.ok) return { success: false, error: claim.error };

    // The plan comes from the order we wrote at checkout time, never from input.
    const plan = getPlanDefinition(claim.order.planSlug ?? "free_trial");
    if (plan.monthlyPrice <= 0) {
      return { success: false, error: "This order has no purchasable plan." };
    }

    await prisma.payment.update({
      where: { providerOrderId: input.orderId },
      data: { status: "SUCCESS", providerPaymentId: input.paymentId },
    });

    await activatePaidPlan({
      userId,
      planSlug: plan.slug,
      paymentId: input.paymentId,
      providerOrderId: input.orderId,
      amountRupees: claim.order.amount,
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
 * Verifies Razorpay checkout signature and adds the GSTIN capacity that was paid for.
 */
export async function confirmGstinAddonPaymentAction(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const claim = await claimPendingOrder({
      userId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
      paymentType: "ADDITIONAL_GSTIN",
    });
    if (!claim.ok) return { success: false, error: claim.error };

    // Quantity comes from the stored order, so a ₹6 payment cannot be confirmed
    // as a thousand slots.
    const meta = (claim.order.metadata ?? {}) as { quantity?: number };
    const quantity = Number(meta.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { success: false, error: "Order is missing a valid quantity." };
    }

    await prisma.payment.update({
      where: { providerOrderId: input.orderId },
      data: { status: "SUCCESS", providerPaymentId: input.paymentId },
    });

    await addGstinCapacity({
      userId,
      quantity,
      amountRupees: claim.order.amount,
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
    if (!isPurchasable(targetPlanSlug)) {
      return { success: false, error: "That plan is not available yet." };
    }
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
