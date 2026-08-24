import { describe, it, expect } from "vitest";
import {
  computeCapacity,
  evaluateActivation,
  activationCeiling,
  isAbnormalChurn,
  consumesCapacity,
  normalizeGstin,
  GstinStatus,
} from "@/features/billing/domain/gstin-capacity";

const ceilingFor = (total: number) => activationCeiling(total, 5);

describe("normalizeGstin", () => {
  it("uppercases and trims", () => {
    expect(normalizeGstin("  27aabcs1234a1z5 ")).toBe("27AABCS1234A1Z5");
  });
});

describe("consumesCapacity", () => {
  it("only ACTIVE consumes a slot", () => {
    expect(consumesCapacity(GstinStatus.ACTIVE)).toBe(true);
    expect(consumesCapacity(GstinStatus.ARCHIVED)).toBe(false);
    expect(consumesCapacity(GstinStatus.INACTIVE_FOR_BILLING)).toBe(false);
    expect(consumesCapacity(GstinStatus.PENDING_DELETE)).toBe(false);
  });
});

describe("computeCapacity", () => {
  it("total is base + additional; used is active count", () => {
    const s = computeCapacity({ base: 15, additional: 4, activeCount: 15, archivedCount: 6 });
    expect(s.total).toBe(19);
    expect(s.active).toBe(15);
    expect(s.archived).toBe(6);
    expect(s.available).toBe(4);
    expect(s.hasFreeSlot).toBe(true);
  });

  it("archived profiles do not consume capacity", () => {
    // 10 base, 3 active, 7 archived → 7 slots free despite 10 total profiles.
    const s = computeCapacity({ base: 10, additional: 0, activeCount: 3, archivedCount: 7 });
    expect(s.available).toBe(7);
    expect(s.level).toBe("OK");
  });

  it("reports LIMIT_REACHED at full and clamps available to zero", () => {
    const s = computeCapacity({ base: 15, additional: 0, activeCount: 15, archivedCount: 0 });
    expect(s.available).toBe(0);
    expect(s.hasFreeSlot).toBe(false);
    expect(s.level).toBe("LIMIT_REACHED");
  });

  it("surfaces 80% and 90% warning bands", () => {
    expect(
      computeCapacity({ base: 10, additional: 0, activeCount: 8, archivedCount: 0 }).level
    ).toBe("WARNING_80");
    expect(
      computeCapacity({ base: 10, additional: 0, activeCount: 9, archivedCount: 0 }).level
    ).toBe("WARNING_90");
  });
});

describe("acceptance: capacity gating", () => {
  // TEST 1 — plan 15, active 15, create another → BLOCKED
  it("blocks activation at full capacity", () => {
    const s = computeCapacity({ base: 15, additional: 0, activeCount: 15, archivedCount: 0 });
    const d = evaluateActivation({
      available: s.available,
      periodNewActivations: 0,
      activationCeiling: ceilingFor(s.total),
      isReactivationOfKnownGstin: false,
    });
    expect(d.allowed).toBe(false);
    expect(d).toMatchObject({ code: "NO_CAPACITY" });
  });

  // TEST 2 — plan 15, active 14, create another → SUCCESS
  it("allows activation with a free slot", () => {
    const s = computeCapacity({ base: 15, additional: 0, activeCount: 14, archivedCount: 0 });
    const d = evaluateActivation({
      available: s.available,
      periodNewActivations: 0,
      activationCeiling: ceilingFor(s.total),
      isReactivationOfKnownGstin: false,
    });
    expect(d.allowed).toBe(true);
  });

  // TEST 3 / 9 — base 15 + add-on 1 = 16, active 16, archive one → 15 active, 1 free,
  // and the freed slot is reusable without paying again (add-on stays capacity).
  it("frees a slot on archive and lets the slot be reused for free", () => {
    const full = computeCapacity({ base: 15, additional: 1, activeCount: 16, archivedCount: 0 });
    expect(full.available).toBe(0);

    const afterArchive = computeCapacity({
      base: 15,
      additional: 1,
      activeCount: 15,
      archivedCount: 1,
    });
    expect(afterArchive.available).toBe(1);
    expect(afterArchive.total).toBe(16); // add-on not lost by archiving

    const d = evaluateActivation({
      available: afterArchive.available,
      periodNewActivations: 1,
      activationCeiling: ceilingFor(afterArchive.total),
      isReactivationOfKnownGstin: true,
    });
    expect(d.allowed).toBe(true);
  });
});

describe("acceptance: per-cycle activation ceiling (anti-abuse)", () => {
  it("blocks a new GSTIN once the cycle activation ceiling is hit", () => {
    // total 15 → ceiling 20. 20 distinct new GSTINs already activated this period.
    const total = 15;
    const d = evaluateActivation({
      available: 1, // a slot exists (churned via archives)
      periodNewActivations: 20,
      activationCeiling: ceilingFor(total),
      isReactivationOfKnownGstin: false,
    });
    expect(d.allowed).toBe(false);
    expect(d).toMatchObject({ code: "CYCLE_ACTIVATION_LIMIT" });
  });

  it("still allows re-activating a GSTIN already used this period, even past the ceiling", () => {
    const d = evaluateActivation({
      available: 1,
      periodNewActivations: 20,
      activationCeiling: ceilingFor(15),
      isReactivationOfKnownGstin: true,
    });
    expect(d.allowed).toBe(true);
  });

  it("gives normal replacement headroom above plan capacity", () => {
    // total 15, ceiling 20: the 16th–20th brand-new activation of the period is fine
    // as long as a slot is free (achieved by archiving).
    const d = evaluateActivation({
      available: 1,
      periodNewActivations: 16,
      activationCeiling: ceilingFor(15),
      isReactivationOfKnownGstin: false,
    });
    expect(d.allowed).toBe(true);
  });
});

describe("churn detection", () => {
  it("flags abnormal churn at the configured ceiling", () => {
    expect(isAbnormalChurn({ opsInWindow: 30, maxOpsInWindow: 30 })).toBe(true);
    expect(isAbnormalChurn({ opsInWindow: 29, maxOpsInWindow: 30 })).toBe(false);
  });
});

describe("activationCeiling", () => {
  it("is total capacity plus replacement allowance", () => {
    expect(activationCeiling(15, 5)).toBe(20);
    expect(activationCeiling(0, 5)).toBe(5);
  });
});
