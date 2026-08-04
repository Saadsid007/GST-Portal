import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The wallet ledger is exercised against an in-memory stand-in for Prisma rather
 * than a live database, so the suite stays runnable in CI without Postgres. The
 * fake models the two behaviours the invariant depends on: `$transaction` runs the
 * callback against the same store, and `$queryRaw` (the `FOR UPDATE` row lock)
 * returns the current row.
 */

interface FakeWallet {
  id: string;
  userId: string;
  balance: number;
  lifetimeRecharged: number;
  lifetimeUsed: number;
  bonusEarned: number;
  referralEarned: number;
  adminCredited: number;
  freeGenerationsUsed: number;
  isFrozen: boolean;
}

interface FakeTransaction {
  id: string;
  walletId: string;
  type: string;
  creditAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
}

const wallets = new Map<string, FakeWallet>();
const ledger: FakeTransaction[] = [];
let nextId = 1;

function emptyWallet(userId: string): FakeWallet {
  return {
    id: `w${nextId++}`,
    userId,
    balance: 0,
    lifetimeRecharged: 0,
    lifetimeUsed: 0,
    bonusEarned: 0,
    referralEarned: 0,
    adminCredited: 0,
    freeGenerationsUsed: 0,
    isFrozen: false,
  };
}

function applyIncrements(target: FakeWallet, data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object" && "increment" in value) {
      const current = target[key as keyof FakeWallet];
      Reflect.set(target, key, (current as number) + (value as { increment: number }).increment);
    } else {
      Reflect.set(target, key, value);
    }
  }
}

const client: {
  $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
  $queryRaw: (strings: TemplateStringsArray, userId: string) => Promise<unknown[]>;
  wallet: {
    upsert: (args: { where: { userId: string } }) => Promise<FakeWallet>;
    update: (args: {
      where: { id?: string; userId?: string };
      data: Record<string, unknown>;
    }) => Promise<FakeWallet>;
  };
  walletTransaction: {
    create: (args: { data: Omit<FakeTransaction, "id"> }) => Promise<FakeTransaction>;
  };
} = {
  $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(client),

  // Stands in for `SELECT ... FOR UPDATE`, returning snake_case columns.
  $queryRaw: (_strings: TemplateStringsArray, userId: string) => {
    const wallet = wallets.get(userId);
    if (!wallet) return Promise.resolve([]);
    return Promise.resolve([
      {
        id: wallet.id,
        balance: wallet.balance,
        is_frozen: wallet.isFrozen,
        free_generations_used: wallet.freeGenerationsUsed,
      },
    ]);
  },

  wallet: {
    upsert: ({ where }: { where: { userId: string } }) => {
      const existing = wallets.get(where.userId);
      if (existing) return Promise.resolve(existing);
      const created = emptyWallet(where.userId);
      wallets.set(where.userId, created);
      return Promise.resolve(created);
    },
    update: ({
      where,
      data,
    }: {
      where: { id?: string; userId?: string };
      data: Record<string, unknown>;
    }) => {
      const wallet = where.userId
        ? wallets.get(where.userId)
        : [...wallets.values()].find((w) => w.id === where.id);
      if (!wallet) throw new Error("wallet not found");
      applyIncrements(wallet, data);
      return Promise.resolve(wallet);
    },
  },

  walletTransaction: {
    create: ({ data }: { data: Omit<FakeTransaction, "id"> }) => {
      const row: FakeTransaction = { id: `t${nextId++}`, ...data };
      ledger.push(row);
      return Promise.resolve(row);
    },
  },
};

vi.mock("@/lib/prisma", () => ({ default: client }));

const {
  creditWallet,
  debitWallet,
  adjustWallet,
  consumeFreeGeneration,
  getOrCreateWallet,
  setWalletFrozen,
  WalletError,
} = await import("@/features/billing/services/wallet.service");

const USER = "user-1";

beforeEach(async () => {
  wallets.clear();
  ledger.length = 0;
  nextId = 1;
  await getOrCreateWallet(USER);
});

describe("getOrCreateWallet", () => {
  it("creates a zero-balance wallet on first touch and reuses it after", async () => {
    const first = await getOrCreateWallet("user-2");
    expect(first.balance).toBe(0);
    const second = await getOrCreateWallet("user-2");
    expect(second.id).toBe(first.id);
    expect(wallets.size).toBe(2);
  });
});

describe("creditWallet", () => {
  it("writes a ledger row for every credit", async () => {
    await creditWallet({ userId: USER, credits: 199, type: "RECHARGE", description: "Recharge" });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      type: "RECHARGE",
      creditAmount: 199,
      balanceBefore: 0,
      balanceAfter: 199,
    });
    expect(wallets.get(USER)?.balance).toBe(199);
  });

  it("rolls recharges into lifetimeRecharged and bonuses into bonusEarned", async () => {
    await creditWallet({ userId: USER, credits: 199, type: "RECHARGE", description: "Recharge" });
    await creditWallet({ userId: USER, credits: 19, type: "BONUS", description: "Wallet bonus" });
    const wallet = wallets.get(USER);
    expect(wallet?.lifetimeRecharged).toBe(199);
    expect(wallet?.bonusEarned).toBe(19);
    expect(wallet?.balance).toBe(218);
  });

  it("tracks referral and admin credits in their own counters", async () => {
    await creditWallet({
      userId: USER,
      credits: 25,
      type: "REFERRAL_REWARD",
      description: "Referral",
    });
    await creditWallet({
      userId: USER,
      credits: 50,
      type: "ADMIN_CREDIT",
      description: "Goodwill",
    });
    const wallet = wallets.get(USER);
    expect(wallet?.referralEarned).toBe(25);
    expect(wallet?.adminCredited).toBe(50);
    expect(wallet?.lifetimeRecharged).toBe(0);
  });

  it("refuses a zero or negative credit", async () => {
    await expect(
      creditWallet({ userId: USER, credits: 0, type: "RECHARGE", description: "x" })
    ).rejects.toThrow(WalletError);
    await expect(
      creditWallet({ userId: USER, credits: -5, type: "RECHARGE", description: "x" })
    ).rejects.toThrow(WalletError);
  });

  it("credits a frozen wallet — freezing stops spending, not top-ups", async () => {
    await setWalletFrozen(USER, true);
    await creditWallet({ userId: USER, credits: 100, type: "RECHARGE", description: "Recharge" });
    expect(wallets.get(USER)?.balance).toBe(100);
  });
});

describe("debitWallet", () => {
  it("deducts the generation cost and records a signed negative amount", async () => {
    await creditWallet({ userId: USER, credits: 218, type: "RECHARGE", description: "Recharge" });
    const result = await debitWallet({
      userId: USER,
      credits: 6,
      type: "GENERATION",
      description: "GSTR-1 generation",
    });

    expect(result.balanceBefore).toBe(218);
    expect(result.balanceAfter).toBe(212);
    expect(ledger.at(-1)).toMatchObject({
      type: "GENERATION",
      creditAmount: -6,
      balanceAfter: 212,
    });
    expect(wallets.get(USER)?.lifetimeUsed).toBe(6);
  });

  it("refuses when the balance is below the cost, leaving no ledger row", async () => {
    await creditWallet({ userId: USER, credits: 5, type: "RECHARGE", description: "Recharge" });
    const before = ledger.length;

    await expect(
      debitWallet({ userId: USER, credits: 6, type: "GENERATION", description: "GSTR-1" })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });

    expect(ledger).toHaveLength(before);
    expect(wallets.get(USER)?.balance).toBe(5);
  });

  it("refuses a frozen wallet even when the balance is sufficient", async () => {
    await creditWallet({ userId: USER, credits: 500, type: "RECHARGE", description: "Recharge" });
    await setWalletFrozen(USER, true);

    await expect(
      debitWallet({ userId: USER, credits: 6, type: "GENERATION", description: "GSTR-1" })
    ).rejects.toMatchObject({ code: "WALLET_FROZEN" });

    expect(wallets.get(USER)?.balance).toBe(500);
  });

  it("allows spending down to exactly zero but not past it", async () => {
    await creditWallet({ userId: USER, credits: 6, type: "RECHARGE", description: "Recharge" });
    await debitWallet({ userId: USER, credits: 6, type: "GENERATION", description: "GSTR-1" });
    expect(wallets.get(USER)?.balance).toBe(0);

    await expect(
      debitWallet({ userId: USER, credits: 1, type: "GENERATION", description: "GSTR-1" })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
  });

  it("refuses a wallet that does not exist", async () => {
    await expect(
      debitWallet({ userId: "ghost", credits: 6, type: "GENERATION", description: "GSTR-1" })
    ).rejects.toMatchObject({ code: "WALLET_MISSING" });
  });
});

describe("ledger continuity", () => {
  it("keeps balanceBefore/balanceAfter unbroken across a credit → debit → credit sequence", async () => {
    await creditWallet({ userId: USER, credits: 199, type: "RECHARGE", description: "Recharge" });
    await creditWallet({ userId: USER, credits: 19, type: "BONUS", description: "Bonus" });
    await debitWallet({ userId: USER, credits: 6, type: "GENERATION", description: "Gen 1" });
    await debitWallet({ userId: USER, credits: 6, type: "GENERATION", description: "Gen 2" });
    await creditWallet({
      userId: USER,
      credits: 25,
      type: "REFERRAL_REWARD",
      description: "Referral",
    });

    for (let i = 1; i < ledger.length; i += 1) {
      expect(ledger[i]?.balanceBefore).toBe(ledger[i - 1]?.balanceAfter);
    }

    const last = ledger.at(-1);
    expect(last?.balanceAfter).toBe(231);
    // The materialised balance must equal the ledger's final running total.
    expect(wallets.get(USER)?.balance).toBe(last?.balanceAfter);
    // And it must equal the sum of every signed amount.
    expect(ledger.reduce((sum, row) => sum + row.creditAmount, 0)).toBe(231);
  });
});

describe("adjustWallet", () => {
  it("credits on a positive adjustment", async () => {
    await adjustWallet({ userId: USER, credits: 40, description: "Goodwill" });
    expect(wallets.get(USER)?.balance).toBe(40);
    expect(ledger.at(-1)?.creditAmount).toBe(40);
  });

  it("debits on a negative adjustment and clamps at zero rather than going negative", async () => {
    await creditWallet({ userId: USER, credits: 10, type: "RECHARGE", description: "Recharge" });
    await adjustWallet({
      userId: USER,
      credits: -50,
      description: "Correcting a duplicate credit",
    });

    expect(wallets.get(USER)?.balance).toBe(0);
    expect(ledger.at(-1)?.creditAmount).toBe(-10);
    expect(ledger.at(-1)?.balanceAfter).toBe(0);
  });

  it("debits a frozen wallet — an admin can still correct a mistake", async () => {
    await creditWallet({ userId: USER, credits: 100, type: "RECHARGE", description: "Recharge" });
    await setWalletFrozen(USER, true);
    await adjustWallet({ userId: USER, credits: -30, description: "Reversal" });
    expect(wallets.get(USER)?.balance).toBe(70);
  });
});

describe("consumeFreeGeneration", () => {
  it("never mints credits — it only increments the usage counter", async () => {
    const result = await consumeFreeGeneration(USER, 2, null);

    expect(result).toEqual({ used: 1, remaining: 1 });
    expect(wallets.get(USER)?.balance).toBe(0);
    expect(ledger.at(-1)).toMatchObject({
      type: "FREE_TRIAL",
      creditAmount: 0,
      balanceBefore: 0,
      balanceAfter: 0,
    });
  });

  it("refuses the third generation once the 2-generation trial is spent", async () => {
    await consumeFreeGeneration(USER, 2, null);
    await consumeFreeGeneration(USER, 2, null);

    await expect(consumeFreeGeneration(USER, 2, null)).rejects.toMatchObject({
      code: "INSUFFICIENT_CREDITS",
    });
    expect(wallets.get(USER)?.freeGenerationsUsed).toBe(2);
  });
});
