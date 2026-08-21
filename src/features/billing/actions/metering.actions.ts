"use server";

import { requireSession } from "@/features/auth";
import { getWorkspaceEntitlements } from "@/features/billing/services/entitlement.service";
import type { ActionResult, GenerationGrant } from "@/features/billing/types/billing.types";

/**
 * Verifies subscription entitlement for GSTR-1 generation.
 * In accordance with the business model, GSTR-1 generation inside an active
 * plan or 30-day free trial is UNLIMITED and never deducts credits.
 */
export async function consumeGenerationCreditAction(
  _referenceId?: string | null
): Promise<ActionResult<GenerationGrant>> {
  const session = await requireSession();
  const userId = session.user.id;

  try {
    const entitlements = await getWorkspaceEntitlements(userId);

    if (!entitlements.canGenerateGstr1) {
      return {
        success: false,
        error:
          "Your 30-day free trial / subscription has expired. Please upgrade or renew your plan on the Billing page to generate GSTR-1 returns.",
      };
    }

    return {
      success: true,
      data: {
        watermark: false,
        creditsCharged: 0,
        balanceAfter: 0,
        usedFreeTrial: entitlements.subscription.isTrial,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not verify subscription status.",
    };
  }
}

/**
 * Returns entitlement quote preview for generation step.
 */
export async function getGenerationQuoteAction(): Promise<
  ActionResult<{
    planSlug: string;
    planName: string;
    isActive: boolean;
    isTrial: boolean;
    daysRemaining: number;
    watermark: boolean;
  }>
> {
  const session = await requireSession();
  const ent = await getWorkspaceEntitlements(session.user.id);

  return {
    success: true,
    data: {
      planSlug: ent.subscription.planSlug,
      planName: ent.subscription.planName,
      isActive: ent.subscription.isActive,
      isTrial: ent.subscription.isTrial,
      daysRemaining: ent.subscription.daysRemaining,
      watermark: false,
    },
  };
}
