import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Credit codes are hand-issued money. The rules that matter: exact amount with no
 * bonus slab, one redemption per account, refused once the admin's user limit is
 * reached, and no referral settlement as a side effect.
 */

interface FakeWallet {
  userId: string;
  balance: number;
  lifetimeRecharged: number;
  bonusEarned: number;
  isFrozen: boolean;
}

interface FakeCode {
  id: string;
  code: string;
  credits: number;
  maxRedemptions: number;
  redemptionCount: number;
  expiresAt: Date | null;
  isActive: boolean;
}

const wallets = new Map<string, FakeWallet>();
const codes = new Map<string, FakeCode>();
const redemptions: { creditCodeId: string; userId: string; credits: number }[] = [];
const ledger: { type: string; creditAmount: number }[] = [];
const referralCalls: string[] = [];
let ids = 0;

function walletOf(userId: string): FakeWallet {
  const existing = wallets.get(userId);
  if (existing) return existing;
  const created: FakeWallet = {
    userId,
    balance: 0,
    lifetimeRecharged: 0,
    bonusEarned: 0,
    isFrozen: false,
  };
  wallets.set(userId, created);
  return created;
}

function bump(target: Record<string, unknown>, data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object" && "increment" in value) {
      target[key] = (target[key] as number) + (value as { increment: number }).increment;
    } else {
      target[key] = value;
    }
  }
}

const client: Record<string, never> & {
  $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
} = {
  $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(client),

  $queryRaw: (_s: TemplateStringsArray, userId: string) => {
    const wallet = wallets.get(userId);
    if (!wallet) return Promise.resolve([]);
    return Promise.resolve([
      { id: userId, balance: wallet.balance, is_frozen: wallet.isFrozen, free_generations_used: 0 },
    ]);
  },

  wallet: {
    upsert: ({ where }: { where: { userId: string } }) => Promise.resolve(walletOf(where.userId)),
    update: ({
      where,
      data,
    }: {
      where: { id?: string; userId?: string };
      data: Record<string, unknown>;
    }) => {
      const wallet = walletOf((where.userId ?? where.id) as string);
      bump(wallet as unknown as Record<string, unknown>, data);
      return Promise.resolve(wallet);
    },
  },

  walletTransaction: {
    create: ({ data }: { data: { type: string; creditAmount: number } }) => {
      ledger.push({ type: data.type, creditAmount: data.creditAmount });
      return Promise.resolve({ id: `t${(ids += 1)}`, ...data });
    },
  },

  creditCode: {
    findUnique: ({ where }: { where: { code: string } }) =>
      Promise.resolve(codes.get(where.code) ?? null),
    update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = [...codes.values()].find((c) => c.id === where.id);
      if (!row) throw new Error("code missing");
      bump(row as unknown as Record<string, unknown>, data);
      return Promise.resolve(row);
    },
  },

  creditCodeRedemption: {
    findUnique: ({
      where,
    }: {
      where: { creditCodeId_userId: { creditCodeId: string; userId: string } };
    }) => {
      const key = where.creditCodeId_userId;
      return Promise.resolve(
        redemptions.find((r) => r.creditCodeId === key.creditCodeId && r.userId === key.userId) ??
          null
      );
    },
    create: ({ data }: { data: { creditCodeId: string; userId: string; credits: number } }) => {
      const clash = redemptions.find(
        (r) => r.creditCodeId === data.creditCodeId && r.userId === data.userId
      );
      // Emulates @@unique([creditCodeId, userId]).
      if (clash) throw new Error("Unique constraint failed");
      redemptions.push(data);
      return Promise.resolve({ id: `r${(ids += 1)}`, ...data });
    },
  },

  billingConfig: { findUnique: () => Promise.resolve(null) },
} as never;

vi.mock("@/lib/prisma", () => ({ default: client }));
vi.mock("@/features/billing/services/referral.service", () => ({
  settleReferralOnFirstRecharge: (_tx: unknown, userId: string) => {
    referralCalls.push(userId);
    return Promise.resolve();
  },
}));

const { redeemCreditCode, CreditCodeError } =
  await import("@/features/billing/services/credit-code.service");

const USER = "user-1";
const OTHER = "user-2";

function seedCode(overrides: Partial<FakeCode> = {}): FakeCode {
  const row: FakeCode = {
    id: `c${(ids += 1)}`,
    code: "GIFT-ABC123",
    credits: 500,
    maxRedemptions: 1,
    redemptionCount: 0,
    expiresAt: null,
    isActive: true,
    ...overrides,
  };
  codes.set(row.code, row);
  return row;
}

beforeEach(() => {
  wallets.clear();
  codes.clear();
  redemptions.length = 0;
  ledger.length = 0;
  referralCalls.length = 0;
  ids = 0;
  walletOf(USER);
  walletOf(OTHER);
});

describe("redeemCreditCode", () => {
  it("grants the exact credit amount with no bonus slab applied", async () => {
    seedCode();
    const result = await redeemCreditCode(USER, "GIFT-ABC123");

    expect(result.credits).toBe(500);
    expect(result.balanceAfter).toBe(500);
    expect(ledger).toEqual([{ type: "PROMO_CODE", creditAmount: 500 }]);
    // Gift credits must never inflate lifetimeRecharged — that drives the referral trigger.
    expect(wallets.get(USER)?.lifetimeRecharged).toBe(0);
  });

  it("normalises a lowercase, padded code", async () => {
    seedCode();
    await expect(redeemCreditCode(USER, "  gift-abc123 ")).resolves.toMatchObject({ credits: 500 });
  });

  it("refuses a second redemption by the same account", async () => {
    seedCode({ maxRedemptions: 5 });
    await redeemCreditCode(USER, "GIFT-ABC123");

    await expect(redeemCreditCode(USER, "GIFT-ABC123")).rejects.toThrow(CreditCodeError);
    expect(wallets.get(USER)?.balance).toBe(500);
  });

  it("stays valid for exactly as many users as the admin allowed", async () => {
    seedCode({ maxRedemptions: 2 });
    await redeemCreditCode(USER, "GIFT-ABC123");
    await redeemCreditCode(OTHER, "GIFT-ABC123");
    walletOf("user-3");

    await expect(redeemCreditCode("user-3", "GIFT-ABC123")).rejects.toThrow(/fully redeemed/);
    expect(codes.get("GIFT-ABC123")?.redemptionCount).toBe(2);
  });

  it("refuses an expired code", async () => {
    seedCode({ expiresAt: new Date("2020-01-01T00:00:00Z") });
    await expect(
      redeemCreditCode(USER, "GIFT-ABC123", new Date("2026-01-01T00:00:00Z"))
    ).rejects.toThrow(/expired/);
    expect(ledger).toHaveLength(0);
  });

  it("refuses a deactivated code", async () => {
    seedCode({ isActive: false });
    await expect(redeemCreditCode(USER, "GIFT-ABC123")).rejects.toThrow(/no longer active/);
  });

  it("refuses an unknown code", async () => {
    await expect(redeemCreditCode(USER, "GIFT-NOPE00")).rejects.toThrow(/not valid/);
  });

  it("does not settle a pending referral", async () => {
    seedCode();
    await redeemCreditCode(USER, "GIFT-ABC123");
    // Only a real Razorpay recharge may unlock a referral payout.
    expect(referralCalls).toEqual([]);
  });
});
