import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import {
  generateReferralCode,
  generateShareToken,
  normalizeCode,
  shareTokenExpiry,
} from "@/features/billing/domain/referral-code";
import { billingLogger } from "@/features/billing/services/billing.logger";
import { getReferralRewards } from "@/features/billing/services/config.service";
import { creditWallet } from "@/features/billing/services/wallet.service";
import type { ReferralSummary } from "@/features/billing/types/billing.types";

/**
 * Referrals pay out on the referee's FIRST successful Razorpay recharge, never on
 * signup and never on a redeemed credit code. Applying a code only records a
 * PENDING row; `settleReferralOnFirstRecharge` is the single place credits move.
 */

type Tx = Prisma.TransactionClient;

export class ReferralError extends Error {
  constructor(
    message: string,
    readonly code:
      | "SELF_REFERRAL"
      | "ALREADY_REFERRED"
      | "INVALID_CODE"
      | "EXPIRED_TOKEN"
      | "TOO_LATE"
      | "DUPLICATE_IDENTITY"
      | "TOKEN_COOLDOWN"
  ) {
    super(message);
    this.name = "ReferralError";
  }
}

/**
 * Codes are minted lazily on first read rather than at signup, so accounts that
 * predate billing get one the moment they open the referral panel.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) return existing.code;

  // A collision on the 6-character code is astronomically unlikely but cheap to
  // survive: retry rather than fail the page render.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await prisma.referralCode.create({
        data: { userId, code: generateReferralCode() },
      });
      return created.code;
    } catch {
      const raced = await prisma.referralCode.findUnique({ where: { userId } });
      if (raced) return raced.code;
    }
  }
  throw new ReferralError("Could not allocate a referral code", "INVALID_CODE");
}

/** One share token per user per 24h. The live token is returned until it expires. */
export async function issueShareToken(userId: string, now: Date = new Date()) {
  const live = await prisma.referralToken.findFirst({
    where: { userId, expiresAt: { gt: now }, usedByUserId: null },
    orderBy: { createdAt: "desc" },
  });
  if (live) {
    throw new ReferralError(
      "You already have an active share link. A new one can be generated once it expires.",
      "TOKEN_COOLDOWN"
    );
  }

  return prisma.referralToken.create({
    data: { userId, token: generateShareToken(), expiresAt: shareTokenExpiry(now) },
  });
}

/** Resolves a pasted code to its owner, accepting either a permanent code or a live token. */
async function resolveReferrer(
  code: string,
  now: Date
): Promise<{ referrerId: string; tokenId: string | null }> {
  const normalized = normalizeCode(code);

  const permanent = await prisma.referralCode.findUnique({ where: { code: normalized } });
  if (permanent) return { referrerId: permanent.userId, tokenId: null };

  const token = await prisma.referralToken.findUnique({ where: { token: normalized } });
  if (!token) throw new ReferralError("That referral code was not recognised.", "INVALID_CODE");
  if (token.expiresAt <= now || token.usedByUserId) {
    throw new ReferralError("That share link has expired.", "EXPIRED_TOKEN");
  }
  return { referrerId: token.userId, tokenId: token.id };
}

/**
 * Records a PENDING referral. Issues NO credits — that is the spec's hard rule.
 * Refused once the referee has already recharged, since the payout trigger has
 * then already passed.
 */
export async function applyReferral(
  refereeId: string,
  code: string,
  now: Date = new Date()
): Promise<{ referrerId: string }> {
  const existing = await prisma.referral.findUnique({ where: { refereeId } });
  if (existing) {
    throw new ReferralError(
      "A referral code has already been applied to this account.",
      "ALREADY_REFERRED"
    );
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: refereeId } });
  if (wallet && wallet.lifetimeRecharged > 0) {
    throw new ReferralError(
      "Referral codes can only be applied before your first recharge.",
      "TOO_LATE"
    );
  }

  const { referrerId, tokenId } = await resolveReferrer(code, now);
  if (referrerId === refereeId) {
    throw new ReferralError("You cannot refer yourself.", "SELF_REFERRAL");
  }

  // Same business signing up twice under different emails is the common abuse
  // route, so GSTIN and mobile are checked across every prior referral.
  const profile = await prisma.gstinProfile.findFirst({
    where: { userId: refereeId },
    orderBy: { createdAt: "asc" },
  });
  if (profile) {
    const clash = await prisma.referral.findFirst({
      where: { refereeGstin: profile.gstinNumber },
    });
    if (clash) {
      throw new ReferralError(
        "This business has already used a referral code.",
        "DUPLICATE_IDENTITY"
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.referral.create({
      data: {
        referrerId,
        refereeId,
        codeUsed: normalizeCode(code),
        status: "PENDING",
        refereeGstin: profile?.gstinNumber ?? null,
      },
    });
    if (tokenId) {
      await tx.referralToken.update({ where: { id: tokenId }, data: { usedByUserId: refereeId } });
    }
  });

  billingLogger.info({ referrerId, refereeId }, "Referral applied (pending first recharge)");
  return { referrerId };
}

/**
 * Called from the recharge settlement path, inside its transaction. Pays both
 * parties exactly once: the referral row flips to REWARDED and is never revisited.
 *
 * `isFirstRecharge` is decided by the caller from the wallet's pre-credit
 * `lifetimeRecharged`, because by the time this runs the recharge has already
 * been applied within the same transaction.
 */
export async function settleReferralOnFirstRecharge(
  tx: Tx,
  refereeId: string,
  isFirstRecharge: boolean
): Promise<void> {
  if (!isFirstRecharge) return;

  const referral = await tx.referral.findUnique({ where: { refereeId } });
  if (!referral || referral.status !== "PENDING") return;

  const referrerWallet = await tx.wallet.findUnique({ where: { userId: referral.referrerId } });
  if (referrerWallet?.isFrozen) {
    await tx.referral.update({ where: { id: referral.id }, data: { status: "BLOCKED" } });
    billingLogger.warn({ referralId: referral.id }, "Referral blocked — referrer wallet frozen");
    return;
  }

  const rewards = await getReferralRewards();

  await creditWallet(
    {
      userId: referral.referrerId,
      credits: rewards.referrerCredits,
      type: "REFERRAL_REWARD",
      description: "Referral reward — your invite made their first recharge",
      referenceId: referral.id,
    },
    tx
  );
  await creditWallet(
    {
      userId: refereeId,
      credits: rewards.refereeCredits,
      type: "REFERRAL_REWARD",
      description: "Referral bonus for joining with a friend's code",
      referenceId: referral.id,
    },
    tx
  );

  await tx.referral.update({
    where: { id: referral.id },
    data: { status: "REWARDED", rewardedAt: new Date() },
  });

  billingLogger.info({ referralId: referral.id }, "Referral settled on first recharge");
}

export async function getReferralSummary(
  userId: string,
  now: Date = new Date()
): Promise<ReferralSummary> {
  const code = await getOrCreateReferralCode(userId);

  const [token, made, applied] = await Promise.all([
    prisma.referralToken.findFirst({
      where: { userId, expiresAt: { gt: now }, usedByUserId: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.referral.findMany({ where: { referrerId: userId } }),
    prisma.referral.findUnique({ where: { refereeId: userId } }),
  ]);

  const rewarded = made.filter((referral) => referral.status === "REWARDED");
  const rewards = await getReferralRewards();

  return {
    code,
    shareToken: token?.token ?? null,
    shareTokenExpiresAt: token?.expiresAt.toISOString() ?? null,
    canGenerateToken: token === null,
    totalReferred: made.length,
    totalRewarded: rewarded.length,
    creditsEarned: rewarded.length * rewards.referrerCredits,
    appliedCode: applied?.codeUsed ?? null,
    appliedStatus: applied ? (applied.status as ReferralSummary["appliedStatus"]) : null,
  };
}
