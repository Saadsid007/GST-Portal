import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The QR purchase path grants entitlements, so the thing worth pinning down is
 * that it grants them exactly once and only from server-stored order data — the
 * dialog's poll and the webhook both call settlePurchaseQr and can race.
 */

const state = {
  payment: null as null | {
    id: string;
    userId: string;
    status: string;
    amount: number;
    planSlug: string | null;
    paymentType: string;
    providerQrCodeId: string;
    metadata: unknown;
  },
  capturedPayments: [] as Array<{ id: string; status: string }>,
  activateCalls: [] as Array<{ planSlug: string; amountRupees: number }>,
  capacityCalls: [] as Array<{ quantity: number; amountRupees: number }>,
};

vi.mock("@/lib/prisma", () => ({
  default: {
    payment: {
      findFirst: vi.fn(async () => state.payment),
      create: vi.fn(async () => state.payment),
      updateMany: vi.fn(async ({ where }: { where: { status: string } }) => {
        // Mirrors the conditional CREATED -> SUCCESS claim.
        if (state.payment && state.payment.status === where.status) {
          state.payment.status = "SUCCESS";
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
  },
}));

vi.mock("@/features/billing/services/razorpay.service", () => ({
  createUpiQrCode: vi.fn(),
  fetchQrPayments: vi.fn(async () => state.capturedPayments),
}));

vi.mock("@/features/billing/services/subscription.service", () => ({
  activatePaidPlan: vi.fn(async (input: { planSlug: string; amountRupees: number }) => {
    state.activateCalls.push(input);
  }),
  getOrCreateSubscription: vi.fn(async () => ({ endDate: new Date() })),
}));

vi.mock("@/features/billing/services/capacity.service", () => ({
  addGstinCapacity: vi.fn(async (input: { quantity: number; amountRupees: number }) => {
    state.capacityCalls.push(input);
  }),
  calculateGstinAddonProration: vi.fn(),
}));

vi.mock("@/features/billing/services/billing.logger", () => ({
  billingLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { settlePurchaseQr } = await import("@/features/billing/services/subscription-qr.service");

beforeEach(() => {
  state.capturedPayments = [];
  state.activateCalls = [];
  state.capacityCalls = [];
});

function planOrder(overrides: Partial<NonNullable<typeof state.payment>> = {}) {
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

  it("activates the plan recorded on the order, not one supplied by a caller", async () => {
    planOrder();
    state.capturedPayments = [{ id: "rp_1", status: "captured" }];

    const result = await settlePurchaseQr("user_1", "qr_1");

    expect(result.state).toBe("paid");
    expect(state.activateCalls).toHaveLength(1);
    expect(state.activateCalls[0]).toMatchObject({ planSlug: "growth", amountRupees: 129 });
  });

  it("grants exactly once when the poll and the webhook race", async () => {
    planOrder();
    state.capturedPayments = [{ id: "rp_1", status: "captured" }];

    await settlePurchaseQr("user_1", "qr_1");
    await settlePurchaseQr("user_1", "qr_1");

    // Second call finds the row already claimed and must not re-grant.
    expect(state.activateCalls).toHaveLength(1);
  });

  it("adds the quantity recorded on the order", async () => {
    addonOrder(3);
    state.capturedPayments = [{ id: "rp_2", status: "captured" }];

    const result = await settlePurchaseQr("user_1", "qr_2");

    expect(result.state).toBe("paid");
    expect(state.capacityCalls).toHaveLength(1);
    expect(state.capacityCalls[0]).toMatchObject({ quantity: 3, amountRupees: 12 });
  });

  it("refuses an add-on order with no usable quantity", async () => {
    addonOrder(0);
    state.capturedPayments = [{ id: "rp_3", status: "captured" }];

    await expect(settlePurchaseQr("user_1", "qr_2")).rejects.toThrow(/quantity/i);
    expect(state.capacityCalls).toHaveLength(0);
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
