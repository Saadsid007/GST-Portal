import { describe, it, expect } from "vitest";
import {
  normalizeStateCode,
  getStateName,
  STATE_CODES,
} from "@/features/convert/domain/state-codes";

/**
 * Daman & Diu (25) and Dadra & Nagar Haveli (26) became one union territory on
 * 26 January 2020, and the portal retired code 25. A return carrying 25 is
 * reporting a place of supply that no longer exists.
 */
describe("the merged union territory", () => {
  it("never returns the retired code, whichever way it arrives", () => {
    // The remap used to sit at the top of the function and only catch a bare
    // "25", so a state name and a GSTIN prefix both came out as 25 — and a
    // Meesho export writes the name.
    expect(normalizeStateCode("25")).toBe("26");
    expect(normalizeStateCode("DAMAN AND DIU")).toBe("26");
    expect(normalizeStateCode("Daman & Diu")).toBe("26");
    expect(normalizeStateCode("25AAAAA0000A1Z5")).toBe("26");
  });

  it("reads the merged name Meesho actually writes", () => {
    // This spelling matched no alias, fell through to a substring search, and
    // hit the shorter "Daman & Diu" sitting above it in the table.
    expect(normalizeStateCode("DADRA & NAGAR HAVELI AND DAMAN & DIU")).toBe("26");
    expect(normalizeStateCode("Dadra and Nagar Haveli and Daman and Diu")).toBe("26");
  });

  it("reads either half on its own", () => {
    expect(normalizeStateCode("DADRA AND NAGAR HAVELI")).toBe("26");
    expect(normalizeStateCode("dadra nagar haveli")).toBe("26");
  });

  it("does not offer 25 as a state at all", () => {
    expect(STATE_CODES["25"]).toBeUndefined();
    expect(getStateName("26")).toBe("Dadra and Nagar Haveli and Daman and Diu");
  });
});

describe("the states this did not change", () => {
  it("still reads codes, short codes and GSTIN prefixes", () => {
    expect(normalizeStateCode("27")).toBe("27");
    expect(normalizeStateCode("7")).toBe("07");
    expect(normalizeStateCode("09BHCPS1644C1ZI")).toBe("09");
  });

  it("still reads names and the spellings marketplaces use", () => {
    expect(normalizeStateCode("KARNATAKA")).toBe("29");
    expect(normalizeStateCode("Uttar Pradesh")).toBe("09");
    expect(normalizeStateCode("Chattisgarh")).toBe("22");
    expect(normalizeStateCode("ANDAMAN & NICOBAR ISLANDS")).toBe("35");
    expect(normalizeStateCode("new delhi")).toBe("07");
  });

  it("returns nothing for something that is not a state", () => {
    expect(normalizeStateCode("")).toBe("");
    expect(normalizeStateCode("Atlantis")).toBe("");
    expect(normalizeStateCode(null)).toBe("");
  });
});
