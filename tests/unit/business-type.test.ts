import { describe, expect, it } from "vitest";
import {
  businessTypeFacets,
  businessTypeMeta,
  BUSINESS_TYPES,
  isBusinessType,
} from "@/features/profile/domain/business-type";
import { filterGstinProfiles } from "@/features/profile/domain/gstin-search";

const profiles = [
  { businessType: "ECOMMERCE_SELLER" },
  { businessType: "ECOMMERCE_SELLER" },
  { businessType: "TRADER" },
  // A row written before the column existed, or by a future version.
  { businessType: "SOMETHING_UNKNOWN" },
];

describe("business type", () => {
  it("falls back instead of throwing on an unknown value", () => {
    expect(businessTypeMeta("SOMETHING_UNKNOWN").value).toBe("OTHER");
    expect(businessTypeMeta("").value).toBe("OTHER");
    expect(isBusinessType("TRADER")).toBe(true);
    expect(isBusinessType("nope")).toBe(false);
  });

  it("builds facets only for categories actually present", () => {
    const facets = businessTypeFacets(profiles);
    const values = facets.map((f) => f.meta.value);
    expect(values).toContain("ECOMMERCE_SELLER");
    expect(values).toContain("TRADER");
    // Nothing is a manufacturer, so no manufacturer chip.
    expect(values).not.toContain("MANUFACTURER");
  });

  it("counts each category, mapping unknown values into OTHER", () => {
    const facets = businessTypeFacets(profiles);
    const byValue = Object.fromEntries(facets.map((f) => [f.meta.value, f.count]));
    expect(byValue["ECOMMERCE_SELLER"]).toBe(2);
    expect(byValue["TRADER"]).toBe(1);
    expect(byValue["OTHER"]).toBe(1);
  });

  it("keeps facets in canonical order", () => {
    const all = BUSINESS_TYPES.map((t) => ({ businessType: t }));
    const order = businessTypeFacets(all).map((f) => f.meta.value);
    expect(order).toEqual([...BUSINESS_TYPES]);
  });

  it("totals the facet counts back to the input length", () => {
    const total = businessTypeFacets(profiles).reduce((t, f) => t + f.count, 0);
    expect(total).toBe(profiles.length);
  });
});

describe("gstin search with business type", () => {
  const rows = [
    {
      gstinNumber: "29AABCU9603R1ZX",
      legalName: "Nova Retail",
      stateCode: "29",
      stateName: "Karnataka",
      businessType: "ECOMMERCE_SELLER",
    },
    {
      gstinNumber: "27AAGCO1234K1Z5",
      legalName: "Orion Traders",
      stateCode: "27",
      stateName: "Maharashtra",
      businessType: "TRADER",
    },
  ];

  it("matches on the business type, underscores treated as spaces", () => {
    expect(filterGstinProfiles(rows, "ecommerce")).toHaveLength(1);
    expect(filterGstinProfiles(rows, "ecommerce")[0]?.legalName).toBe("Nova Retail");
    // "trader" hits Orion twice over (legal name and business type) but that is
    // still one row — matching must not duplicate.
    expect(filterGstinProfiles(rows, "trader")).toHaveLength(1);
    expect(filterGstinProfiles(rows, "trader")[0]?.legalName).toBe("Orion Traders");
  });
});
