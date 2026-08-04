import prisma from "@/lib/prisma";
import { generateCreditCode, normalizeCode } from "@/features/billing/domain/referral-code";
import { creditWallet, getOrCreateWallet } from "@/features/billing/services/wallet.service";

/**
 * Admin-issued gift codes, entirely separate from referrals. A code grants its
 * exact credit amount with no bonus slab applied, and redeeming one deliberately
 * does NOT settle a pending referral — otherwise an admin handing out codes could
 * be used to farm referral payouts.
 */

export class CreditCodeError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_CODE" | "INACTIVE" | "EXPIRED" | "EXHAUSTED" | "ALREADY_REDEEMED"
  ) {
    super(message);
    this.name = "CreditCodeError";
  }
}

export interface RedemptionResult {
  credits: number;
  balanceAfter: number;
}

export async function redeemCreditCode(
  userId: string,
  rawCode: string,
  now: Date = new Date()
): Promise<RedemptionResult> {
  const code = normalizeCode(rawCode);
  await getOrCreateWallet(userId);

  return prisma.$transaction(async (tx) => {
    const creditCode = await tx.creditCode.findUnique({ where: { code } });
    if (!creditCode) {
      throw new CreditCodeError("That code is not valid.", "INVALID_CODE");
    }
    if (!creditCode.isActive) {
      throw new CreditCodeError("That code is no longer active.", "INACTIVE");
    }
    if (creditCode.expiresAt && creditCode.expiresAt < now) {
      throw new CreditCodeError("That code has expired.", "EXPIRED");
    }
    if (creditCode.redemptionCount >= creditCode.maxRedemptions) {
      throw new CreditCodeError("That code has been fully redeemed.", "EXHAUSTED");
    }

    const existing = await tx.creditCodeRedemption.findUnique({
      where: { creditCodeId_userId: { creditCodeId: creditCode.id, userId } },
    });
    if (existing) {
      throw new CreditCodeError("You have already redeemed that code.", "ALREADY_REDEEMED");
    }

    // The @@unique([creditCodeId, userId]) is the real race guard: two concurrent
    // redemptions from the same account both pass the check above, but only one
    // insert survives.
    await tx.creditCodeRedemption.create({
      data: { creditCodeId: creditCode.id, userId, credits: creditCode.credits },
    });
    await tx.creditCode.update({
      where: { id: creditCode.id },
      data: { redemptionCount: { increment: 1 } },
    });

    const move = await creditWallet(
      {
        userId,
        credits: creditCode.credits,
        type: "PROMO_CODE",
        description: `Credit code ${creditCode.code}`,
        referenceId: creditCode.id,
      },
      tx
    );

    return { credits: creditCode.credits, balanceAfter: move.balanceAfter };
  });
}

export interface CreditCodeInput {
  code: string;
  credits: number;
  maxRedemptions: number;
  expiresAt: string | null;
  note?: string;
}

export async function createCreditCode(adminId: string, input: CreditCodeInput) {
  const created = await prisma.creditCode.create({
    data: {
      code: normalizeCode(input.code),
      credits: input.credits,
      maxRedemptions: input.maxRedemptions,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      note: input.note ?? null,
      createdById: adminId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "CREDIT_CODE_CREATED",
      targetType: "CreditCode",
      targetId: created.id,
      metadata: {
        code: created.code,
        credits: created.credits,
        maxRedemptions: created.maxRedemptions,
      },
    },
  });

  return created;
}

export async function setCreditCodeActive(
  adminId: string,
  creditCodeId: string,
  isActive: boolean
): Promise<void> {
  await prisma.creditCode.update({ where: { id: creditCodeId }, data: { isActive } });
  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: isActive ? "CREDIT_CODE_ACTIVATED" : "CREDIT_CODE_DEACTIVATED",
      targetType: "CreditCode",
      targetId: creditCodeId,
    },
  });
}

export interface CreditCodeRow {
  id: string;
  code: string;
  credits: number;
  maxRedemptions: number;
  redemptionCount: number;
  expiresAt: string | null;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  redeemedBy: { email: string; redeemedAt: string }[];
}

/** Narrowed for the admin table — no Prisma row crosses the client boundary. */
export async function listCreditCodes(limit = 100): Promise<CreditCodeRow[]> {
  const codes = await prisma.creditCode.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      redemptions: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true } } },
      },
    },
  });

  return codes.map((row) => ({
    id: row.id,
    code: row.code,
    credits: row.credits,
    maxRedemptions: row.maxRedemptions,
    redemptionCount: row.redemptionCount,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    isActive: row.isActive,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    redeemedBy: row.redemptions.map((redemption) => ({
      email: redemption.user.email,
      redeemedAt: redemption.createdAt.toISOString(),
    })),
  }));
}

export function suggestCreditCode(): string {
  return generateCreditCode();
}
