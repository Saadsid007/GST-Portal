import { describe, expect, it } from "vitest";
import { calculateBonus, findBonusSlab } from "@/features/billing/domain/bonus-calculator";
import { BONUS_SLABS } from "@/features/billing/constants/billing.constants";
import { bonusSlabsSchema } from "@/features/billing/schemas/billing.schemas";
import type { BonusSlab, Campaign } from "@/features/billing/types/billing.types";

describe("calculateBonus — worked examples from the pricing spec", () => {
  it("₹30 earns no bonus (below the ₹99 threshold)", () => {
    const result = calculateBonus(30);
    expect(result.baseCredits).toBe(30);
    expect(result.bonusCredits).toBe(0);
    expect(result.totalCredits).toBe(30);
  });

  it("₹120 at 6% gives 127 credits (rounds down from 127.2)", () => {
    expect(calculateBonus(120).totalCredits).toBe(127);
  });

  it("₹350 at 10% gives 385 credits", () => {
    expect(calculateBonus(350).totalCredits).toBe(385);
  });

  it("₹2500 at 25% gives 3125 credits", () => {
    expect(calculateBonus(2500).totalCredits).toBe(3125);
  });
});

describe("calculateBonus — slab boundaries", () => {
  const cases: { amount: number; percent: number }[] = [
    { amount: 20, percent: 0 },
    { amount: 98, percent: 0 },
    { amount: 99, percent: 6 },
    { amount: 198, percent: 6 },
    { amount: 199, percent: 10 },
    { amount: 498, percent: 10 },
    { amount: 499, percent: 15 },
    { amount: 998, percent: 15 },
    { amount: 999, percent: 20 },
    { amount: 1998, percent: 20 },
    { amount: 1999, percent: 25 },
    { amount: 10_000, percent: 25 },
  ];

  it.each(cases)("₹$amount sits in the $percent% slab", ({ amount, percent }) => {
    const result = calculateBonus(amount);
    expect(result.bonusPercent).toBe(percent);
    expect(result.bonusCredits).toBe(Math.floor((amount * percent) / 100));
  });

  it("never rounds a bonus up", () => {
    // ₹101 at 6% is 6.06 — the user gets 6, not 7.
    expect(calculateBonus(101).bonusCredits).toBe(6);
  });

  it("custom recharge below ₹99 stays strictly worse than the Starter pack", () => {
    // The retention design: a ₹98 custom top-up must not beat the ₹99 pack.
    expect(calculateBonus(98).bonusCredits).toBe(0);
    expect(calculateBonus(99).bonusCredits).toBeGreaterThan(0);
  });
});

describe("findBonusSlab", () => {
  it("returns null below the lowest slab rather than throwing", () => {
    expect(findBonusSlab(5, BONUS_SLABS)).toBeNull();
  });

  it("matches the open-ended top slab for very large amounts", () => {
    expect(findBonusSlab(999_999, BONUS_SLABS)?.bonusPercent).toBe(25);
  });
});

describe("calculateBonus — admin campaigns", () => {
  const campaign: Campaign = {
    id: "diwali",
    name: "Diwali Bonanza",
    isActive: true,
    bonusMultiplier: 1,
    extraBonusPercent: 10,
    startsAt: null,
    endsAt: null,
  };

  it("adds the campaign's extra percent on top of the slab", () => {
    // ₹350 normally earns 10%; the campaign lifts it to 20%.
    const result = calculateBonus(350, BONUS_SLABS, campaign);
    expect(result.bonusPercent).toBe(20);
    expect(result.totalCredits).toBe(420);
    expect(result.campaignName).toBe("Diwali Bonanza");
  });

  it("scales the slab bonus by the multiplier", () => {
    const doubled: Campaign = { ...campaign, extraBonusPercent: 0, bonusMultiplier: 2 };
    expect(calculateBonus(350, BONUS_SLABS, doubled).bonusPercent).toBe(20);
  });

  it("ignores an inactive campaign", () => {
    const off: Campaign = { ...campaign, isActive: false };
    expect(calculateBonus(350, BONUS_SLABS, off).bonusPercent).toBe(10);
    expect(calculateBonus(350, BONUS_SLABS, off).campaignName).toBeNull();
  });

  it("ignores a campaign that has not started or has already ended", () => {
    const now = new Date("2026-08-04T00:00:00Z");
    const future: Campaign = { ...campaign, startsAt: "2026-10-01T00:00:00Z", endsAt: null };
    const past: Campaign = { ...campaign, startsAt: null, endsAt: "2026-01-01T00:00:00Z" };
    expect(calculateBonus(350, BONUS_SLABS, future, now).bonusPercent).toBe(10);
    expect(calculateBonus(350, BONUS_SLABS, past, now).bonusPercent).toBe(10);
  });
});

describe("bonusSlabsSchema — admin-edited slab tables", () => {
  const valid: BonusSlab[] = [
    { minAmount: 20, maxAmount: 98, bonusPercent: 0 },
    { minAmount: 99, maxAmount: null, bonusPercent: 12 },
  ];

  it("accepts a contiguous table with one open-ended top slab", () => {
    expect(bonusSlabsSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts the seeded defaults", () => {
    expect(bonusSlabsSchema.safeParse([...BONUS_SLABS]).success).toBe(true);
  });

  it("rejects a gap between slabs", () => {
    const gapped = [
      { minAmount: 20, maxAmount: 98, bonusPercent: 0 },
      { minAmount: 150, maxAmount: null, bonusPercent: 12 },
    ];
    expect(bonusSlabsSchema.safeParse(gapped).success).toBe(false);
  });

  it("rejects overlapping slabs", () => {
    const overlapping = [
      { minAmount: 20, maxAmount: 120, bonusPercent: 0 },
      { minAmount: 99, maxAmount: null, bonusPercent: 12 },
    ];
    expect(bonusSlabsSchema.safeParse(overlapping).success).toBe(false);
  });

  it("rejects a percentage above 100", () => {
    const tooHigh = [{ minAmount: 20, maxAmount: null, bonusPercent: 150 }];
    expect(bonusSlabsSchema.safeParse(tooHigh).success).toBe(false);
  });

  it("rejects a table whose top slab is not open-ended", () => {
    const capped = [{ minAmount: 20, maxAmount: 500, bonusPercent: 5 }];
    expect(bonusSlabsSchema.safeParse(capped).success).toBe(false);
  });

  it("rejects an open-ended slab that is not last", () => {
    const misplaced = [
      { minAmount: 20, maxAmount: null, bonusPercent: 0 },
      { minAmount: 99, maxAmount: null, bonusPercent: 12 },
    ];
    expect(bonusSlabsSchema.safeParse(misplaced).success).toBe(false);
  });

  it("rejects a slab whose maximum is below its minimum", () => {
    const inverted = [{ minAmount: 500, maxAmount: 100, bonusPercent: 5 }];
    expect(bonusSlabsSchema.safeParse(inverted).success).toBe(false);
  });

  it("prices from an admin-edited table, not the compiled defaults", () => {
    // The admin lifts the ₹199–498 band from 10% to 12%: ₹350 → 392.
    const edited: BonusSlab[] = [
      { minAmount: 20, maxAmount: 98, bonusPercent: 0 },
      { minAmount: 99, maxAmount: null, bonusPercent: 12 },
    ];
    expect(calculateBonus(350, edited).totalCredits).toBe(392);
  });
});
