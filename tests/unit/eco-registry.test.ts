import { describe, it, expect } from "vitest";
import {
  resolveEcoGstin,
  ensureTcsGstin,
  isValidGstin,
} from "@/features/convert/config/eco-registry";

describe("the operator a marketplace sale was collected through", () => {
  it("reproduces every operator GSTIN a filed return carries", () => {
    // From returns filed through the portal and the operators' own exports.
    expect(
      resolveEcoGstin({ platformId: "flipkart", supplierGstin: "27AAJCP8507D1ZC" }).ecoGstin
    ).toBe("27AACCF0683K1CS");
    expect(
      resolveEcoGstin({ platformId: "amazon", supplierGstin: "27AAJCP8507D1ZC" }).ecoGstin
    ).toBe("27AAICA3918J1CT");
    expect(
      resolveEcoGstin({ platformId: "amazon", supplierGstin: "29AAAAA0000A1Z5" }).ecoGstin
    ).toBe("29AAICA3918J1CP");
    expect(
      resolveEcoGstin({ platformId: "meesho", supplierGstin: "09BUXPG2404E1ZM" }).ecoGstin
    ).toBe("09AARCM9332R1CM");
  });

  it("gives Flipkart sellers Flipkart Internet, the marketplace", () => {
    // The old table gave Flipkart India's number — the wholesale company,
    // which collects no TCS.
    const eco = resolveEcoGstin({ platformId: "flipkart", supplierGstin: "09AGCPW4984F2ZT" });

    expect(eco.ecoGstin).toBe("09AACCF0683K1CQ");
    expect(eco.status).toBe("VERIFIED");
  });

  it("ignores a saved GSTIN that belongs to another business", () => {
    // Earlier conversions saved the old table's Flipkart India number to the
    // profile, and a saved value outranks everything.
    const eco = resolveEcoGstin({
      platformId: "flipkart",
      supplierGstin: "09AGCPW4984F2ZT",
      userFallbackGstin: "09AABCF8078M1CA",
    });

    expect(eco.ecoGstin).toBe("09AACCF0683K1CQ");
  });

  it("does not invent a number for an operator it does not know", () => {
    const eco = resolveEcoGstin({ platformId: "jiomart", supplierGstin: "09AGCPW4984F2ZT" });

    expect(eco.ecoGstin).toBe("");
    expect(eco.isReliable).toBe(false);
  });

  it("recomputes the check digit when it makes a registration a collector's", () => {
    // Setting the 14th character alone left a number that exists nowhere.
    expect(ensureTcsGstin("27AAICA3918J1ZI")).toBe("27AAICA3918J1CT");
    expect(isValidGstin(ensureTcsGstin("29AAICA3918J1ZE"))).toBe(true);
  });
});
