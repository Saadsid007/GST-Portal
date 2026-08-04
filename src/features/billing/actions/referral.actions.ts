"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/features/auth";
import { billingLogger } from "@/features/billing/services/billing.logger";
import {
  applyReferral,
  getReferralSummary,
  issueShareToken,
  ReferralError,
} from "@/features/billing/services/referral.service";
import { applyReferralSchema } from "@/features/billing/schemas/billing.schemas";
import type { ActionResult, ReferralSummary } from "@/features/billing/types/billing.types";

export async function getReferralAction(): Promise<ActionResult<ReferralSummary>> {
  const session = await requireSession();
  return { success: true, data: await getReferralSummary(session.user.id) };
}

export async function generateShareTokenAction(): Promise<
  ActionResult<{ token: string; expiresAt: string }>
> {
  const session = await requireSession();
  try {
    const token = await issueShareToken(session.user.id);
    revalidatePath("/billing");
    return {
      success: true,
      data: { token: token.token, expiresAt: token.expiresAt.toISOString() },
    };
  } catch (error) {
    if (error instanceof ReferralError) return { success: false, error: error.message };
    billingLogger.error({ userId: session.user.id, err: error }, "Share token generation failed");
    return { success: false, error: "Could not generate a share link. Please try again." };
  }
}

/**
 * Records the code against the signed-in account. Deliberately issues no credits
 * — the reward waits for the referee's first successful Razorpay recharge.
 */
export async function applyReferralAction(code: string): Promise<ActionResult<null>> {
  const session = await requireSession();
  const parsed = applyReferralSchema.safeParse({ code });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid code" };
  }

  try {
    await applyReferral(session.user.id, parsed.data.code);
    revalidatePath("/billing");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof ReferralError) return { success: false, error: error.message };
    billingLogger.error({ userId: session.user.id, err: error }, "Referral application failed");
    return { success: false, error: "Could not apply that code. Please try again." };
  }
}
