import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The QR purchase path grants entitlements, so the thing worth pinning down is
 * that it grants them exactly once and only from server-stored order data — the
 * dialog's poll and the webhook both call settlePurchaseQr and can race — and
 * that the grant completes the order's own row rather than writing a second
 * one (which broke the payment id's unique index and rolled the grant back).
 */

type Row = {
  id: string;
  userId: string;
  status: string;
  amount: number;
  planSlug: string | null;
  paymentType: string;
  providerQrCodeId: string | null;
  metadata: unknown;
};

const state = {
  payment: null as null | Row,
  created: [] as Row[],
  capturedPayments: [] as Array<{ id: string; status: string }>,
  activateCalls: [] as Array<{ planSlug: string; amountRupees: number; paymentRecordId?: string }>,
  capacityCalls: [] as Array<{ quantity: number; amountRupees: number; paymentRecordId?: string }>,
  debits: [] as Array<{ credits: number; referenceId: string }>,
  wallet: null as null | { balance: number; isFrozen: boolean },
  failActivation: false,
  referralCalls: 0,
};

function rowById(id: string) {
  return [state.payment, ...state.created].find((r) => r?.id === id) ?? null;
}

vi.mock("@/lib/prisma", () => ({
  default: {
    payment: {
      findFirst: vi.fn(async () => state.payment),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rowById(where.id)),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => rowById(where.id)),
      count: vi.fn(async () => 1),
      create: vi.fn(async ({ data }: { data: Partial<Row> }) => {
        const row = { ...data, id: `row_${state.created.length + 1}` } as Row;
        state.created.push(row);
        return row;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; status: string };
          data: { status: string };
        }) => {
          // Mirrors the conditional claim and its release.
          const row = rowById(where.id);
          if (row && row.status === where.status) {
            row.status = data.status;
            return { count: 1 };
          }
          return { count: 0 };
        }
      ),
    },
    wallet: { findUnique: vi.fn(async () => state.wallet) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  },
}));

vi.mock("@/features/billing/services/razorpay.service", () => ({
  QR_TTL_SECONDS: 1200,
  createUpiQrCode: vi.fn(async ({ amountRupees }: { amountRupees: number }) => ({
    qrCodeId: "qr_new",
    imageUrl: "https://example.test/qr.png",
    closeBy: 0,
    amountRupees,
  })),
  fetchQrPayments: vi.fn(async () => state.capturedPayments),
}));

vi.mock("@/features/billing/services/subscription.service", () => ({
  activatePaidPlan: vi.fn(
    async (input: { planSlug: string; amountRupees: number; paymentRecordId?: string }) => {
      if (state.failActivation) throw new Error("db down");
      state.activateCalls.push(input);
    }
  ),
  getOrCreateSubscription: vi.fn(async () => ({ endDate: new Date() })),
}));

vi.mock("@/features/billing/services/capacity.service", () => ({
  addGstinCapacity: vi.fn(
    async (input: { quantity: number; amountRupees: number; paymentRecordId?: string }) => {
      state.capacityCalls.push(input);
    }
  ),
  calculateGstinAddonProration: vi.fn(),
}));

vi.mock("@/features/billing/services/wallet.service", () => ({
  debitWallet: vi.fn(async (input: { credits: number; referenceId: string }) => {
    state.debits.push(input);
  }),
}));

vi.mock("@/features/billing/services/referral.service", () => ({
  settleReferralOnFirstRecharge: vi.fn(async () => {
    state.referralCalls++;
  }),
}));

vi.mock("@/features/billing/services/billing.logger", () => ({
  billingLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { settlePurchaseQr, createPlanQr } =
  await import("@/features/billing/services/subscription-qr.service");

beforeEach(() => {
  state.created = [];
  state.capturedPayments = [];
  state.activateCalls = [];
  state.capacityCalls = [];
  state.debits = [];
  state.wallet = null;
  state.failActivation = false;
  state.referralCalls = 0;
});

function planOrder(overrides: Partial<Row> = {}) {
  state.payment = {
    id: "pay_1",
    userId: "user_1",
    status: "CREATED",
    amount: 129,
    planSlug: "growth",
    paymentType: "SUBSCRIPTION",
    providerQrCodeId: "qr_1",
    metadata: {},
    ...overrides,
  };
}

function addonOrder(quantity: number) {
  state.payment = {
    id: "pay_2",
    userId: "user_1",
    status: "CREATED",
    amount: 12,
    planSlug: null,
    paymentType: "ADDITIONAL_GSTIN",
    providerQrCodeId: "qr_2",
    metadata: { quantity },
  };
}

describe("settlePurchaseQr", () => {
  it("stays pending while no payment has been captured", async () => {
    planOrder();
    const result = await settlePurchaseQr("user_1", "qr_1");
    expect(result.state).toBe("pending");
    expect(state.activateCalls).toHaveLength(0);
  });

  it("activates the plan recorded on the order, completing that same row", async () => {
    planOrder();
    state.capturedPayments = [{ id: "rp_1", status: "captured" }];

    const result = await settlePurchaseQr("user_1", "qr_1");

    expect(result.state).toBe("paid");
    expect(state.activateCalls).toHaveLength(1);
    expect(state.activateCalls[0]).toMatchObject({
      planSlug: "growth",
      amountRupees: 129,
      paymentRecordId: "pay_1",
    });
  });

  it("grants exactly once when the poll and the webhook race", async () => {
    planOrder();
    state.capturedPayments = [{ id: "rp_1", status: "captured" }];

    await settlePurchaseQr("user_1", "qr_1");
    await settlePurchaseQr("user_1", "qr_1");

    expect(state.activateCalls).toHaveLength(1);
  });

  it("adds the quantity recorded on the order", async () => {
    addonOrder(3);
    state.capturedPayments = [{ id: "rp_2", status: "captured" }];

    const result = await settlePurchaseQr("user_1", "qr_2");

    expect(result.state).toBe("paid");
    expect(state.capacityCalls).toHaveLength(1);
    expect(state.capacityCalls[0]).toMatchObject({
      quantity: 3,
      amountRupees: 12,
      paymentRecordId: "pay_2",
    });
  });

  it("refuses an add-on order with no usable quantity, and releases the claim", async () => {
    addonOrder(0);
    state.capturedPayments = [{ id: "rp_3", status: "captured" }];

    await expect(settlePurchaseQr("user_1", "qr_2")).rejects.toThrow(/quantity/i);
    expect(state.capacityCalls).toHaveLength(0);
    expect(state.payment?.status).toBe("CREATED");
  });

  it("releases the claim when the grant fails, so a retry can deliver it", async () => {
    planOrder();
    state.capturedPayments = [{ id: "rp_1", status: "captured" }];
    state.failActivation = true;

    await expect(settlePurchaseQr("user_1", "qr_1")).rejects.toThrow(/db down/);
    expect(state.payment?.status).toBe("CREATED");

    state.failActivation = false;
    await settlePurchaseQr("user_1", "qr_1");
    expect(state.activateCalls).toHaveLength(1);
  });

  it("spends the credits the order reserved once it is paid", async () => {
    planOrder({ amount: 99, metadata: { walletCredits: 30 } });
    state.capturedPayments = [{ id: "rp_1", status: "captured" }];

    await settlePurchaseQr("user_1", "qr_1");

    expect(state.debits).toEqual([expect.objectContaining({ credits: 30, referenceId: "pay_1" })]);
  });

  it("rejects a QR that belongs to nobody the caller owns", async () => {
    state.payment = null;
    await expect(settlePurchaseQr("user_1", "qr_missing")).rejects.toThrow(/unknown payment/i);
  });

  it("reports an already-settled order as paid without re-granting", async () => {
    planOrder({ status: "SUCCESS" });
    const result = await settlePurchaseQr("user_1", "qr_1");
    expect(result.state).toBe("paid");
    expect(state.activateCalls).toHaveLength(0);
  });
});

describe("wallet credits at checkout", () => {
  it("takes the balance off the price and asks UPI only for the rest", async () => {
    state.payment = null;
    state.wallet = { balance: 50, isFrozen: false };

    const qr = await createPlanQr("user_1", "growth");

    expect(qr.kind).toBe("qr");
    expect(qr.creditsApplied).toBe(50);
    expect(qr.amount).toBe(qr.listPrice - 50);
  });

  it("settles at once from the wallet when credits cover the whole price", async () => {
    state.payment = null;
    state.wallet = { balance: 10_000, isFrozen: false };

    const qr = await createPlanQr("user_1", "growth");

    expect(qr.kind).toBe("wallet");
    expect(qr.amount).toBe(0);
    expect(state.activateCalls).toHaveLength(1);
    expect(state.debits[0]?.credits).toBe(qr.listPrice);
  });

  it("applies nothing from a frozen wallet", async () => {
    state.payment = null;
    state.wallet = { balance: 500, isFrozen: true };

    const qr = await createPlanQr("user_1", "growth");

    expect(qr.creditsApplied).toBe(0);
    expect(qr.amount).toBe(qr.listPrice);
  });
});
