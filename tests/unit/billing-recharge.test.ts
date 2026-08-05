import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Settlement is the highest-risk path in billing: a double credit is real money
 * given away, and a missed credit is a customer who paid and got nothing. These
 * tests drive `settleRecharge` against an in-memory Prisma stand-in to prove it
 * credits exactly once no matter how many times it is called.
 */

interface FakeWallet {
  userId: string;
  balance: number;
  lifetimeRecharged: number;
  bonusEarned: number;
  referralEarned: number;
  isFrozen: boolean;
}

interface FakeOrder {
  id: string;
  userId: string;
  razorpayOrderId: string | null;
  razorpayQrCodeId: string | null;
  razorpayPaymentId: string | null;
  amount: number;
  bonusCredits: number;
  totalCredits: number;
  status: string;
  webhookEventId: string | null;
}

interface FakeReferral {
  id: string;
  referrerId: string;
  refereeId: string;
  status: string;
  rewardedAt: Date | null;
}

const wallets = new Map<string, FakeWallet>();
const orders = new Map<string, FakeOrder>();
const referrals = new Map<string, FakeReferral>();
const ledger: { userId: string; type: string; creditAmount: number }[] = [];
let ids = 0;

function walletOf(userId: string): FakeWallet {
  const existing = wallets.get(userId);
  if (existing) return existing;
  const created: FakeWallet = {
    userId,
    balance: 0,
    lifetimeRecharged: 0,
    bonusEarned: 0,
    referralEarned: 0,
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
    findUnique: ({ where }: { where: { userId: string } }) =>
      Promise.resolve(wallets.get(where.userId) ?? null),
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
    create: ({ data }: { data: { walletId: string; type: string; creditAmount: number } }) => {
      const row = { id: `t${(ids += 1)}`, ...data };
      ledger.push({ userId: data.walletId, type: data.type, creditAmount: data.creditAmount });
      return Promise.resolve(row);
    },
  },

  rechargeOrder: {
    findUnique: ({ where }: { where: { razorpayOrderId?: string; razorpayQrCodeId?: string } }) => {
      const found = [...orders.values()].find((o) =>
        where.razorpayOrderId
          ? o.razorpayOrderId === where.razorpayOrderId
          : o.razorpayQrCodeId === where.razorpayQrCodeId
      );
      return Promise.resolve(found ?? null);
    },
    update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const order = [...orders.values()].find((o) => o.id === where.id);
      if (!order) throw new Error("order missing");
      // Emulates the @unique on webhook_event_id.
      const eventId = data["webhookEventId"];
      if (typeof eventId === "string") {
        const clash = [...orders.values()].find((o) => o.webhookEventId === eventId);
        if (clash) throw new Error("Unique constraint failed on webhook_event_id");
      }
      Object.assign(order, data);
      return Promise.resolve(order);
    },
    updateMany: () => Promise.resolve({ count: 0 }),
  },

  referral: {
    findUnique: ({ where }: { where: { refereeId: string } }) =>
      Promise.resolve([...referrals.values()].find((r) => r.refereeId === where.refereeId) ?? null),
    update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const referral = referrals.get(where.id);
      if (!referral) throw new Error("referral missing");
      Object.assign(referral, data);
      return Promise.resolve(referral);
    },
  },

  billingConfig: {
    findUnique: () => Promise.resolve(null),
  },
} as never;

vi.mock("@/lib/prisma", () => ({ default: client }));

const { settleRecharge } = await import("@/features/billing/services/recharge.service");

const PAYER = "payer-1";

function seedOrder(overrides: Partial<FakeOrder> = {}): FakeOrder {
  const order: FakeOrder = {
    id: `o${(ids += 1)}`,
    userId: PAYER,
    razorpayOrderId: "order_ABC",
    razorpayQrCodeId: null,
    razorpayPaymentId: null,
    amount: 199,
    bonusCredits: 19,
    totalCredits: 218,
    status: "CREATED",
    webhookEventId: null,
    ...overrides,
  };
  orders.set(order.id, order);
  return order;
}

beforeEach(() => {
  wallets.clear();
  orders.clear();
  referrals.clear();
  ledger.length = 0;
  ids = 0;
  walletOf(PAYER);
});

describe("settleRecharge", () => {
  it("credits the base amount and the bonus as two separate ledger rows", async () => {
    seedOrder();
    const result = await settleRecharge({
      razorpayOrderId: "order_ABC",
      razorpayPaymentId: "pay_1",
      eventId: "evt_1",
    });

    expect(result.credited).toBe(true);
    expect(result.balanceAfter).toBe(218);

    const wallet = wallets.get(PAYER);
    // Only rupees actually paid count as recharged; the bonus is tracked apart.
    expect(wallet?.lifetimeRecharged).toBe(199);
    expect(wallet?.bonusEarned).toBe(19);
    expect(ledger.map((row) => row.type)).toEqual(["RECHARGE", "BONUS"]);
  });

  it("credits exactly once when the same event is delivered twice", async () => {
    seedOrder();
    await settleRecharge({
      razorpayOrderId: "order_ABC",
      razorpayPaymentId: "pay_1",
      eventId: "evt_1",
    });
    const replay = await settleRecharge({
      razorpayOrderId: "order_ABC",
      razorpayPaymentId: "pay_1",
      eventId: "evt_1",
    });

    expect(replay.credited).toBe(false);
    expect(wallets.get(PAYER)?.balance).toBe(218);
    expect(ledger).toHaveLength(2);
  });

  it("credits once when the checkout callback and the webhook race", async () => {
    seedOrder();
    await settleRecharge({
      razorpayOrderId: "order_ABC",
      razorpayPaymentId: "pay_1",
      eventId: "checkout:pay_1",
    });
    await settleRecharge({
      razorpayOrderId: "order_ABC",
      razorpayPaymentId: "pay_1",
      eventId: "evt_from_webhook",
    });

    expect(wallets.get(PAYER)?.balance).toBe(218);
  });

  it("skips the bonus row entirely for a sub-₹99 recharge", async () => {
    seedOrder({ amount: 30, bonusCredits: 0, totalCredits: 30 });
    await settleRecharge({
      razorpayOrderId: "order_ABC",
      razorpayPaymentId: "pay_1",
      eventId: "evt_1",
    });

    expect(ledger.map((row) => row.type)).toEqual(["RECHARGE"]);
    expect(wallets.get(PAYER)?.balance).toBe(30);
  });

  it("rejects an unknown order rather than crediting blindly", async () => {
    await expect(
      settleRecharge({
        razorpayOrderId: "order_GHOST",
        razorpayPaymentId: "pay_1",
        eventId: "evt_1",
      })
    ).rejects.toThrow(/Unknown recharge/);
  });

  // UPI QR payments arrive with no order_id — the QR code entity is the only
  // locator Razorpay gives us, so settlement must resolve on it alone.
  it("settles a UPI QR recharge located by its QR code id", async () => {
    seedOrder({ razorpayOrderId: null, razorpayQrCodeId: "qr_XYZ" });

    const result = await settleRecharge({
      razorpayQrCodeId: "qr_XYZ",
      razorpayPaymentId: "pay_qr_1",
      eventId: "qr:pay_qr_1",
    });

    expect(result.credited).toBe(true);
    expect(result.totalCredits).toBe(218);
    expect(wallets.get(PAYER)?.balance).toBe(218);
    expect(ledger.map((row) => row.type)).toEqual(["RECHARGE", "BONUS"]);
  });

  it("credits a QR recharge exactly once when the webhook and the poll race", async () => {
    seedOrder({ razorpayOrderId: null, razorpayQrCodeId: "qr_RACE" });

    const first = await settleRecharge({
      razorpayQrCodeId: "qr_RACE",
      razorpayPaymentId: "pay_qr_2",
      eventId: "qr:pay_qr_2",
    });
    const second = await settleRecharge({
      razorpayQrCodeId: "qr_RACE",
      razorpayPaymentId: "pay_qr_2",
      eventId: "qr:pay_qr_2",
    });

    expect(first.credited).toBe(true);
    expect(second.credited).toBe(false);
    expect(wallets.get(PAYER)?.balance).toBe(218);
  });

  it("refuses to settle when neither locator is supplied", async () => {
    await expect(settleRecharge({ razorpayPaymentId: "pay_1", eventId: "evt_1" })).rejects.toThrow(
      /either a Razorpay order id or a QR code id/
    );
  });
});

describe("settleRecharge — referral payout", () => {
  const REFERRER = "referrer-1";

  beforeEach(() => {
    walletOf(REFERRER);
    referrals.set("r1", {
      id: "r1",
      referrerId: REFERRER,
      refereeId: PAYER,
      status: "PENDING",
      rewardedAt: null,
    });
  });

  it("pays both parties on the referee's first recharge", async () => {
    seedOrder();
    await settleRecharge({
      razorpayOrderId: "order_ABC",
      razorpayPaymentId: "pay_1",
      eventId: "evt_1",
    });

    expect(referrals.get("r1")?.status).toBe("REWARDED");
    expect(wallets.get(REFERRER)?.balance).toBe(25);
    expect(wallets.get(REFERRER)?.referralEarned).toBe(25);
    // 199 + 19 bonus + 25 referral
    expect(wallets.get(PAYER)?.balance).toBe(243);
  });

  it("does not pay again on a second recharge", async () => {
    seedOrder();
    await settleRecharge({
      razorpayOrderId: "order_ABC",
      razorpayPaymentId: "pay_1",
      eventId: "evt_1",
    });
    seedOrder({ razorpayOrderId: "order_DEF", amount: 99, bonusCredits: 5, totalCredits: 104 });
    await settleRecharge({
      razorpayOrderId: "order_DEF",
      razorpayPaymentId: "pay_2",
      eventId: "evt_2",
    });

    expect(wallets.get(REFERRER)?.balance).toBe(25);
  });

  it("blocks the payout when the referrer's wallet is frozen", async () => {
    walletOf(REFERRER).isFrozen = true;
    seedOrder();
    await settleRecharge({
      razorpayOrderId: "order_ABC",
      razorpayPaymentId: "pay_1",
      eventId: "evt_1",
    });

    expect(referrals.get("r1")?.status).toBe("BLOCKED");
    expect(wallets.get(REFERRER)?.balance).toBe(0);
    // The referee still gets their recharge, just no referral bonus.
    expect(wallets.get(PAYER)?.balance).toBe(218);
  });
});
