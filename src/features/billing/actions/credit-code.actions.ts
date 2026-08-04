"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/features/auth";
import { billingLogger } from "@/features/billing/services/billing.logger";
import {
  CreditCodeError,
  redeemCreditCode,
  type RedemptionResult,
} from "@/features/billing/services/credit-code.service";
import { redeemCreditCodeSchema } from "@/features/billing/schemas/billing.schemas";
import type { ActionResult } from "@/features/billing/types/billing.types";

/**
 * Credits granted here are real spendable credits, so a redemption also lifts the
 * free-trial watermark for as long as the balance lasts. It never settles a
 * pending referral — only a Razorpay-settled recharge does.
 */
export async function redeemCreditCodeAction(
  code: string
): Promise<ActionResult<RedemptionResult>> {
  const session = await requireSession();
  const parsed = redeemCreditCodeSchema.safeParse({ code });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid code" };
  }

  try {
    const result = await redeemCreditCode(session.user.id, parsed.data.code);
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof CreditCodeError) return { success: false, error: error.message };
    billingLogger.error({ userId: session.user.id, err: error }, "Credit code redemption failed");
    return { success: false, error: "Could not redeem that code. Please try again." };
  }
}
