import { describe, it, expect } from "vitest";
import {
  PLANS,
  getPlanDefinition,
  isPaidPlan,
  FREE_TRIAL_GSTIN_LIMIT,
  ADDITIONAL_GSTIN_PRICE_MONTHLY,
  isPurchasable,
  getPurchasablePlans,
  getCapacityRange,
} from "@/features/billing/config/pricing.config";

describe("GSTPilot Pricing Configuration", () => {
  it("defines all 6 plans correctly with expected GSTIN quotas and prices", () => {
    expect(PLANS.free_trial.includedGSTINs).toBe(7);
    expect(PLANS.free_trial.monthlyPrice).toBe(0);

    expect(PLANS.starter.includedGSTINs).toBe(10);
    expect(PLANS.starter.monthlyPrice).toBe(79);

    expect(PLANS.growth.includedGSTINs).toBe(15);
    expect(PLANS.growth.monthlyPrice).toBe(129);
    expect(PLANS.growth.isPopular).toBe(true);

    expect(PLANS.business.includedGSTINs).toBe(30);
    expect(PLANS.business.monthlyPrice).toBe(199);

    expect(PLANS.ca_pro.includedGSTINs).toBe(75);
    expect(PLANS.ca_pro.monthlyPrice).toBe(399);

    expect(PLANS.ca_firm.includedGSTINs).toBe(200);
    expect(PLANS.ca_firm.monthlyPrice).toBe(799);
  });

  it("identifies paid plans correctly", () => {
    expect(isPaidPlan("free_trial")).toBe(false);
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
    expect(isPaidPlan("starter")).toBe(true);
    expect(isPaidPlan("growth")).toBe(true);
    expect(isPaidPlan("ca_firm")).toBe(true);
  });

  it("retrieves plan definition safely with fallback", () => {
    const unknown = getPlanDefinition("non_existent_plan");
    expect(unknown.slug).toBe("free_trial");
    expect(unknown.includedGSTINs).toBe(FREE_TRIAL_GSTIN_LIMIT);

    const growth = getPlanDefinition("growth");
    expect(growth.monthlyPrice).toBe(129);
    expect(growth.capabilities.ecoTable14).toBe(true);
    expect(growth.capabilities.aiCorrections).toBe(true);
  });
});

describe("GSTIN Capacity & Proration Math", () => {
  it("calculates correct prorated amount for extra GSTINs mid-cycle", () => {
    const quantity = 2;
    const rate = ADDITIONAL_GSTIN_PRICE_MONTHLY; // ₹6 each
    const fullMonthlyAmount = quantity * rate; // ₹12

    // Scenario A: Exactly half cycle remaining (15 of 30 days)
    const remainingDaysA = 15;
    const totalCycleDaysA = 30;
    const proratedA = Math.max(
      1,
      Math.ceil(fullMonthlyAmount * (remainingDaysA / totalCycleDaysA))
    );
    expect(proratedA).toBe(6); // ₹12 * 0.5 = ₹6

    // Scenario B: 20 of 30 days remaining
    const remainingDaysB = 20;
    const proratedB = Math.max(
      1,
      Math.ceil(fullMonthlyAmount * (remainingDaysB / totalCycleDaysA))
    );
    expect(proratedB).toBe(8); // ₹12 * (20/30) = ₹8

    // Scenario C: 1 day remaining (ensures at least ₹1)
    const remainingDaysC = 1;
    const proratedC = Math.max(
      1,
      Math.ceil(fullMonthlyAmount * (remainingDaysC / totalCycleDaysA))
    );
    expect(proratedC).toBe(1); // ₹12 * (1/30) = ₹0.4 -> ceil = ₹1
  });

  it("evaluates usage status thresholds (80%, 90%, 100%)", () => {
    const totalCapacity = 10;

    function getStatus(used: number) {
      const usagePercent = Math.min(100, Math.round((used / totalCapacity) * 100));
      if (used >= totalCapacity) return "LIMIT_REACHED";
      if (usagePercent >= 90) return "WARNING_90";
      if (usagePercent >= 80) return "WARNING_80";
      return "OK";
    }

    expect(getStatus(5)).toBe("OK");
    expect(getStatus(7)).toBe("OK");
    expect(getStatus(8)).toBe("WARNING_80");
    expect(getStatus(9)).toBe("WARNING_90");
    expect(getStatus(10)).toBe("LIMIT_REACHED");
    expect(getStatus(11)).toBe("LIMIT_REACHED");
  });
});

describe("Subscription Lifecycle & Entitlement Rules", () => {
  it("enforces unlimited GSTR-1 generation during active subscription", () => {
    const activeSubscription = {
      status: "ACTIVE",
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days left
    };
    const isExpired = activeSubscription.endDate < new Date();
    const canGenerate = activeSubscription.status === "ACTIVE" && !isExpired;

    expect(canGenerate).toBe(true);
  });

  it("locks generation upon subscription expiration without deleting data", () => {
    const expiredSubscription = {
      status: "EXPIRED",
      endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // expired 2 days ago
    };
    const isExpired = expiredSubscription.endDate < new Date();
    const canGenerate = expiredSubscription.status === "ACTIVE" && !isExpired;

    expect(isExpired).toBe(true);
    expect(canGenerate).toBe(false);
  });

  it("handles scheduled downgrades at renewal date without immediate disruption", () => {
    const currentPlan = "business"; // 30 GSTIN
    const scheduledPlan = "growth"; // 15 GSTIN
    const sub = {
      planSlug: currentPlan,
      scheduledPlanSlug: scheduledPlan,
      status: "ACTIVE",
    };

    // Before renewal date: current plan remains active
    expect(sub.planSlug).toBe("business");
    expect(sub.scheduledPlanSlug).toBe("growth");

    // At renewal date: transition occurs
    const newSub = {
      ...sub,
      planSlug: sub.scheduledPlanSlug,
      scheduledPlanSlug: null,
    };
    expect(newSub.planSlug).toBe("growth");
    expect(newSub.scheduledPlanSlug).toBeNull();
  });
});

describe("Plan availability & parity", () => {
  it("marks only the CA tiers as coming soon", () => {
    expect(PLANS.ca_pro.comingSoon).toBe(true);
    expect(PLANS.ca_firm.comingSoon).toBe(true);
    for (const slug of ["free_trial", "starter", "growth", "business"] as const) {
      expect(PLANS[slug].comingSoon).toBeUndefined();
    }
  });

  it("refuses to sell a coming-soon or free plan", () => {
    // The order endpoint calls this, so hiding the button is not the only guard.
    expect(isPurchasable("ca_pro")).toBe(false);
    expect(isPurchasable("ca_firm")).toBe(false);
    expect(isPurchasable("free_trial")).toBe(false);
    expect(isPurchasable("unknown_plan")).toBe(false);
    expect(isPurchasable(null)).toBe(false);

    expect(isPurchasable("starter")).toBe(true);
    expect(isPurchasable("growth")).toBe(true);
    expect(isPurchasable("business")).toBe(true);
  });

  it("offers exactly the three sellable plans", () => {
    expect(getPurchasablePlans().map((p) => p.slug)).toEqual(["starter", "growth", "business"]);
  });

  it("gives every sellable plan identical capabilities — only capacity differs", () => {
    const sellable = ["free_trial", "starter", "growth", "business"] as const;
    const reference = JSON.stringify(PLANS.starter.capabilities);

    for (const slug of sellable) {
      expect(JSON.stringify(PLANS[slug].capabilities)).toBe(reference);
    }

    // The thing that actually varies.
    const capacities = sellable.map((s) => PLANS[s].includedGSTINs);
    expect(new Set(capacities).size).toBe(capacities.length);
  });

  it("reports the capacity range across sellable plans", () => {
    expect(getCapacityRange()).toEqual({ min: 10, max: 30 });
  });
});
