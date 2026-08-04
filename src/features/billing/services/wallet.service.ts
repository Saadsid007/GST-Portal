import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { CREDIT_TRANSACTION_TYPES } from "@/features/billing/constants/billing.constants";
import type { TransactionType } from "@/features/billing/types/billing.types";

/**
 * The wallet is the single billing layer for GSTPilot.
 *
 * INVARIANT: `wallet.balance` is never written anywhere except `creditWallet` and
 * `debitWallet` below, and neither one writes it without creating the matching
 * `WalletTransaction` row in the same database transaction. The ledger is the
 * source of truth; `balance` is a materialised running total that must always
 * equal the last row's `balanceAfter`.
 *
 * Anything that needs to move credits — recharge, bonus, referral reward, admin
 * credit, refund, promo code, campaign, generation debit — calls one of these two
 * functions with a different `type`. There is no third path.
 */

type Tx = Prisma.TransactionClient;

/** Thrown for expected, user-facing refusals. Callers map these to error strings. */
export class WalletError extends Error {
  constructor(
    message: string,
    readonly code: "WALLET_FROZEN" | "INSUFFICIENT_CREDITS" | "INVALID_AMOUNT" | "WALLET_MISSING"
  ) {
    super(message);
    this.name = "WalletError";
  }
}

/**
 * Creates the wallet on first touch instead of hooking Better Auth signup. This
 * keeps billing decoupled from the auth config and self-heals for accounts that
 * existed before billing shipped.
 */
export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/**
 * Locks the wallet row for the rest of the transaction. Without this, two
 * concurrent generations could both read balance 6, both pass the check and both
 * debit — driving the balance negative. `FOR UPDATE` serialises them.
 */
async function lockWallet(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<
    { id: string; balance: number; is_frozen: boolean; free_generations_used: number }[]
  >`SELECT id, balance, is_frozen, free_generations_used FROM "wallet" WHERE "user_id" = ${userId} FOR UPDATE`;

  const row = rows[0];
  if (!row) {
    throw new WalletError("Wallet not found", "WALLET_MISSING");
  }
  return {
    id: row.id,
    balance: row.balance,
    isFrozen: row.is_frozen,
    freeGenerationsUsed: row.free_generations_used,
  };
}

/** Which aggregate counter a credit type rolls up into, if any. */
function counterFor(
  type: TransactionType
): "bonusEarned" | "referralEarned" | "adminCredited" | null {
  if (type === "BONUS" || type === "CAMPAIGN" || type === "PROMO_CODE") return "bonusEarned";
  if (type === "REFERRAL_REWARD") return "referralEarned";
  if (type === "ADMIN_CREDIT") return "adminCredited";
  return null;
}

interface MoveInput {
  userId: string;
  credits: number;
  type: TransactionType;
  description: string;
  referenceId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface MoveResult {
  balanceBefore: number;
  balanceAfter: number;
  transactionId: string;
}

/**
 * The only way credits enter a wallet.
 *
 * `tx` is optional: pass an existing transaction client when the credit must be
 * atomic with something else (e.g. marking a recharge order paid, or inserting a
 * credit-code redemption row). Omit it and one is opened here.
 */
export async function creditWallet(input: MoveInput, tx?: Tx): Promise<MoveResult> {
  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new WalletError("Credit amount must be a positive whole number", "INVALID_AMOUNT");
  }
  return tx ? creditInTx(tx, input) : prisma.$transaction((inner) => creditInTx(inner, input));
}

async function creditInTx(tx: Tx, input: MoveInput): Promise<MoveResult> {
  const wallet = await lockWallet(tx, input.userId);
  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore + input.credits;

  const transaction = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: input.type,
      creditAmount: input.credits,
      balanceBefore,
      balanceAfter,
      description: input.description,
      referenceId: input.referenceId ?? null,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    },
  });

  const counter = counterFor(input.type);
  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: balanceAfter,
      ...(input.type === "RECHARGE" ? { lifetimeRecharged: { increment: input.credits } } : {}),
      ...(counter ? { [counter]: { increment: input.credits } } : {}),
    },
  });

  return { balanceBefore, balanceAfter, transactionId: transaction.id };
}

/**
 * The only way credits leave a wallet. Refuses a frozen wallet and refuses to go
 * negative — the balance check happens after the row lock, inside the transaction,
 * so it cannot be raced.
 */
export async function debitWallet(input: MoveInput, tx?: Tx): Promise<MoveResult> {
  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new WalletError("Debit amount must be a positive whole number", "INVALID_AMOUNT");
  }
  return tx ? debitInTx(tx, input) : prisma.$transaction((inner) => debitInTx(inner, input));
}

async function debitInTx(tx: Tx, input: MoveInput): Promise<MoveResult> {
  const wallet = await lockWallet(tx, input.userId);

  if (wallet.isFrozen) {
    throw new WalletError("This wallet is frozen. Please contact support.", "WALLET_FROZEN");
  }
  if (wallet.balance < input.credits) {
    throw new WalletError(
      `Insufficient credits. This action needs ${input.credits} credits and your balance is ${wallet.balance}.`,
      "INSUFFICIENT_CREDITS"
    );
  }

  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore - input.credits;

  const transaction = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: input.type,
      creditAmount: -input.credits, // ledger amounts are signed
      balanceBefore,
      balanceAfter,
      description: input.description,
      referenceId: input.referenceId ?? null,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    },
  });

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: balanceAfter, lifetimeUsed: { increment: input.credits } },
  });

  return { balanceBefore, balanceAfter, transactionId: transaction.id };
}

/**
 * An admin adjustment that can go either way. Positive credits, negative debits.
 * A negative adjustment bypasses the frozen check on purpose: freezing exists to
 * stop the user spending, not to stop an admin correcting a mistake.
 */
export async function adjustWallet(
  input: Omit<MoveInput, "type"> & { type?: TransactionType }
): Promise<MoveResult> {
  const type = input.type ?? "ADJUSTMENT";
  if (input.credits >= 0) {
    return creditWallet({ ...input, type });
  }
  return prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, input.userId);
    const credits = Math.abs(input.credits);
    const balanceBefore = wallet.balance;
    const balanceAfter = Math.max(0, balanceBefore - credits);

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        creditAmount: balanceAfter - balanceBefore,
        balanceBefore,
        balanceAfter,
        description: input.description,
        referenceId: input.referenceId ?? null,
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      },
    });

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
    return { balanceBefore, balanceAfter, transactionId: transaction.id };
  });
}

/**
 * Records a free-trial generation. Writes a zero-credit ledger row purely for the
 * audit trail — the spec is explicit that free generations must never mint credits,
 * so this only increments the usage counter.
 */
export async function consumeFreeGeneration(
  userId: string,
  maxGenerations: number,
  referenceId: string | null
): Promise<{ used: number; remaining: number }> {
  return prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, userId);
    if (wallet.freeGenerationsUsed >= maxGenerations) {
      throw new WalletError("Free trial generations exhausted", "INSUFFICIENT_CREDITS");
    }

    const used = wallet.freeGenerationsUsed + 1;

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "FREE_TRIAL",
        creditAmount: 0,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        description: `Free trial generation ${used} of ${maxGenerations}`,
        referenceId,
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { freeGenerationsUsed: used },
    });

    return { used, remaining: maxGenerations - used };
  });
}

export async function setWalletFrozen(userId: string, isFrozen: boolean): Promise<void> {
  await getOrCreateWallet(userId);
  await prisma.wallet.update({ where: { userId }, data: { isFrozen } });
}

export function isCreditType(type: TransactionType): boolean {
  return (CREDIT_TRANSACTION_TYPES as readonly string[]).includes(type);
}
