import { describe, expect, it } from "vitest";
import {
  filterGstinProfiles,
  matchesGstinQuery,
  type SearchableProfile,
} from "@/features/profile/domain/gstin-search";

const NOVA: SearchableProfile = {
  gstinNumber: "29AABCU9603R1ZX",
  legalName: "Nova Retail Ventures Pvt Ltd",
  tradeName: "NovaMart",
  stateCode: "29",
  stateName: "Karnataka",
  isDefault: true,
};

const ORION: SearchableProfile = {
  gstinNumber: "27AAGCO1234K1Z5",
  legalName: "Orion Traders LLP",
  tradeName: null,
  stateCode: "27",
  stateName: "Maharashtra",
};

const PROFILES = [ORION, NOVA];

describe("matchesGstinQuery", () => {
  it("matches on legal name, trade name and state", () => {
    expect(matchesGstinQuery(NOVA, "nova")).toBe(true);
    expect(matchesGstinQuery(NOVA, "novamart")).toBe(true);
    expect(matchesGstinQuery(NOVA, "karnataka")).toBe(true);
    expect(matchesGstinQuery(NOVA, "29")).toBe(true);
  });

  it("matches a partial GSTIN typed from memory", () => {
    expect(matchesGstinQuery(NOVA, "9603")).toBe(true);
    expect(matchesGstinQuery(NOVA, "1ZX")).toBe(true);
  });

  it("tolerates a GSTIN pasted with spaces or hyphens", () => {
    expect(matchesGstinQuery(NOVA, "29AABCU 9603 R1ZX")).toBe(true);
    expect(matchesGstinQuery(NOVA, "29-AABCU9603R1ZX")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesGstinQuery(ORION, "ORION")).toBe(true);
    expect(matchesGstinQuery(ORION, "orion traders")).toBe(true);
  });

  it("narrows on every term rather than widening", () => {
    // Both terms describe Nova, so it matches.
    expect(matchesGstinQuery(NOVA, "nova karnataka")).toBe(true);
    // "maharashtra" belongs to a different profile, so this must not match.
    expect(matchesGstinQuery(NOVA, "nova maharashtra")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(matchesGstinQuery(NOVA, "")).toBe(true);
    expect(matchesGstinQuery(NOVA, "   ")).toBe(true);
  });

  it("rejects a genuine miss", () => {
    expect(matchesGstinQuery(NOVA, "zzzz")).toBe(false);
  });
});

describe("filterGstinProfiles", () => {
  it("keeps the default profile first so it stays reachable", () => {
    expect(filterGstinProfiles(PROFILES, "")[0]).toBe(NOVA);
  });

  it("narrows to the matching profile", () => {
    expect(filterGstinProfiles(PROFILES, "orion")).toEqual([ORION]);
    expect(filterGstinProfiles(PROFILES, "maharashtra")).toEqual([ORION]);
  });

  it("returns nothing when no profile matches", () => {
    expect(filterGstinProfiles(PROFILES, "no-such-company")).toEqual([]);
  });
});
