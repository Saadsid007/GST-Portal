import { describe, it, expect } from "vitest";
import {
  computeGstinSlotUsage,
  isSlotRetainedOnDelete,
  normalizeGstin,
} from "@/features/billing/domain/gstin-slot-usage";

const A = "27AABCS1234A1Z5";
const B = "29AABCU9603R1ZM";
const C = "07AAACP1234B1Z1";

describe("normalizeGstin", () => {
  it("uppercases and trims so casing never splits one GSTIN into two slots", () => {
    expect(normalizeGstin("  27aabcs1234a1z5 ")).toBe(A);
  });
});

describe("computeGstinSlotUsage", () => {
  it("counts each live profile once", () => {
    const usage = computeGstinSlotUsage({ activeGstins: [A, B], periodGstins: [A, B] });
    expect(usage.consumed).toBe(2);
    expect(usage.activeCount).toBe(2);
    expect(usage.retainedCount).toBe(0);
  });

  it("keeps a deleted GSTIN consuming its slot for the rest of the period", () => {
    // B was created this period and then deleted — the profile is gone, the slot is not.
    const usage = computeGstinSlotUsage({ activeGstins: [A], periodGstins: [A, B] });
    expect(usage.consumed).toBe(2);
    expect(usage.activeCount).toBe(1);
    expect(usage.retainedCount).toBe(1);
    expect(usage.retainedGstins).toEqual([B]);
  });

  it("blocks the delete-and-recreate exploit on a 2-slot plan", () => {
    // Add A and B, delete both, add C: three distinct GSTINs served this period.
    const usage = computeGstinSlotUsage({ activeGstins: [C], periodGstins: [A, B, C] });
    expect(usage.consumed).toBe(3);
    expect(usage.consumed).toBeGreaterThan(2);
  });

  it("does not charge twice when the same GSTIN is deleted and re-added", () => {
    const usage = computeGstinSlotUsage({ activeGstins: [A], periodGstins: [A, A] });
    expect(usage.consumed).toBe(1);
    expect(usage.retainedCount).toBe(0);
  });

  it("counts profiles carried over from an earlier period even though the ledger is empty", () => {
    // After renewal the ledger window is empty, but live profiles still occupy capacity.
    const usage = computeGstinSlotUsage({ activeGstins: [A, B], periodGstins: [] });
    expect(usage.consumed).toBe(2);
    expect(usage.retainedCount).toBe(0);
  });

  it("releases retained slots once the period rolls over", () => {
    const during = computeGstinSlotUsage({ activeGstins: [A], periodGstins: [A, B] });
    const afterRenewal = computeGstinSlotUsage({ activeGstins: [A], periodGstins: [] });
    expect(during.consumed).toBe(2);
    expect(afterRenewal.consumed).toBe(1);
  });

  it("treats differently cased entries as one slot", () => {
    const usage = computeGstinSlotUsage({
      activeGstins: [A.toLowerCase()],
      periodGstins: [A],
    });
    expect(usage.consumed).toBe(1);
  });

  it("reports an empty workspace as zero consumption", () => {
    const usage = computeGstinSlotUsage({ activeGstins: [], periodGstins: [] });
    expect(usage).toEqual({
      consumed: 0,
      activeCount: 0,
      retainedCount: 0,
      retainedGstins: [],
    });
  });
});

describe("isSlotRetainedOnDelete", () => {
  it("retains the slot when the GSTIN was added during this period", () => {
    expect(isSlotRetainedOnDelete({ gstin: A, periodGstins: [A], otherActiveGstins: [] })).toBe(
      true
    );
  });

  it("frees the slot when the GSTIN predates this period", () => {
    expect(isSlotRetainedOnDelete({ gstin: A, periodGstins: [B], otherActiveGstins: [B] })).toBe(
      false
    );
  });

  it("frees nothing when a duplicate profile for the same GSTIN is still live", () => {
    expect(isSlotRetainedOnDelete({ gstin: A, periodGstins: [A], otherActiveGstins: [A] })).toBe(
      false
    );
  });

  it("ignores casing when matching the ledger", () => {
    expect(
      isSlotRetainedOnDelete({
        gstin: A.toLowerCase(),
        periodGstins: [A],
        otherActiveGstins: [],
      })
    ).toBe(true);
  });
});
