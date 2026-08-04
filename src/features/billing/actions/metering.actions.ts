"use server";

import { requireSession } from "@/features/auth";
import { billingLogger } from "@/features/billing/services/billing.logger";
import { getFreeTrialLimits, getGenerationCost } from "@/features/billing/services/config.service";
import {
  getActivePlan,
  getWalletSummary,
  planDefinition,
} from "@/features/billing/services/entitlement.service";
import {
  consumeFreeGeneration,
  debitWallet,
  getOrCreateWallet,
  WalletError,
} from "@/features/billing/services/wallet.service";
import type {
  ActionResult,
  GenerationGrant,
  WalletSummary,
} from "@/features/billing/types/billing.types";

/**
 * The single metering point for a GSTR-1 generation.
 *
 * Called once per journey, from step 9's "Generate Return & Proceed to Download"
 * button — step 10's download buttons deliberately do NOT charge, because a user
 * re-downloading the workbook they already paid for must not be billed again.
 *
 * Order of precedence: an active CA plan generates freely, otherwise remaining
 * free-trial allowances are spent before wallet credits, so a new user never
 * burns paid credits while a free generation is still available.
 */
export async function consumeGenerationCreditAction(
  referenceId?: string | null
): Promise<ActionResult<GenerationGrant>> {
  const session = await requireSession();
  const userId = session.user.id;

  try {
    await getOrCreateWallet(userId);
    const plan = await getActivePlan(userId);

    if (planDefinition(plan).unlimitedGstins) {
      const wallet = await getOrCreateWallet(userId);
      return {
        success: true,
        data: {
          watermark: false,
          creditsCharged: 0,
          balanceAfter: wallet.balance,
          usedFreeTrial: false,
        },
      };
    }

    const [trial, cost] = await Promise.all([getFreeTrialLimits(), getGenerationCost()]);
    const wallet = await getOrCreateWallet(userId);

    // A user who has ever paid is out of the trial, even with allowances left.
    const trialAvailable =
      wallet.lifetimeRecharged === 0 && wallet.freeGenerationsUsed < trial.maxGenerations;

    if (trialAvailable) {
      const result = await consumeFreeGeneration(userId, trial.maxGenerations, referenceId ?? null);
      billingLogger.info({ userId, used: result.used }, "Free trial generation consumed");
      return {
        success: true,
        data: {
          watermark: trial.watermark,
          creditsCharged: 0,
          balanceAfter: wallet.balance,
          usedFreeTrial: true,
        },
      };
    }

    const move = await debitWallet({
      userId,
      credits: cost,
      type: "GENERATION",
      description: "GSTR-1 return generation",
      referenceId: referenceId ?? null,
    });

    billingLogger.info(
      { userId, cost, balanceAfter: move.balanceAfter },
      "Generation credits debited"
    );

    return {
      success: true,
      data: {
        watermark: false,
        creditsCharged: cost,
        balanceAfter: move.balanceAfter,
        usedFreeTrial: false,
      },
    };
  } catch (error) {
    if (error instanceof WalletError) {
      return { success: false, error: error.message };
    }
    billingLogger.error({ userId, err: error }, "Generation metering failed");
    return { success: false, error: "Could not verify your credits. Please try again." };
  }
}

/** Read-only preview used by step 9 to show the cost before the user commits. */
export async function getGenerationQuoteAction(): Promise<ActionResult<WalletSummary>> {
  const session = await requireSession();
  return { success: true, data: await getWalletSummary(session.user.id) };
}
