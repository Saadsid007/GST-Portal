import { describe, it, expect } from "vitest";
import {
  collectAmounts,
  reconcileAmounts,
  amountsAreConsistent,
} from "@/features/pdf-extractor/engine/amount-reconciler";

describe("finding the money on an invoice", () => {
  it("reads figures written the Indian way", () => {
    expect(collectAmounts("Total 1,24,500.00 and 78,000.00")).toEqual([124500, 78000]);
  });

  it("reads a figure prefixed with Rs.", () => {
    // The dot of "Rs." sits directly before the digits. Excluding a preceding
    // "." skipped every amount on a whole marketplace's invoices.
    expect(collectAmounts("Taxable Rs.270.74 IGST @18.0% :Rs.48.73")).toEqual([270.74, 48.73]);
  });

  it("ignores things that are not money", () => {
    // HSN codes, pincodes, quantities, years and rates all look numeric.
    const text = "HSN 48201010 Qty 7800 Pin 400078 Year 2026 GST 18% Amount 92040.00";

    expect(collectAmounts(text)).toEqual([92040]);
  });

  it("keeps a repeated figure, because repetition is evidence", () => {
    // Equal CGST and SGST are what make an intra-state split credible.
    expect(collectAmounts("7020.00 7020.00")).toEqual([7020, 7020]);
  });
});

describe("reconciling an invoice whose labels came apart", () => {
  it("solves the intra-state case from the values alone", () => {
    // A real letterhead invoice: the amount column is emitted as one block and
    // "Sub-total / SGST @9% / CGST @9% / TOTAL" as another, so no label
    // pattern matches anything.
    const amounts = collectAmounts("78000.00 7020.00 7020.00 92040.00");

    expect(reconcileAmounts(amounts)).toMatchObject({
      taxableValue: 78000,
      cgstAmount: 7020,
      sgstAmount: 7020,
      igstAmount: 0,
      totalInvoiceValue: 92040,
      gstRate: 18,
      basis: "intra-state",
    });
  });

  it("solves the inter-state case", () => {
    const amounts = collectAmounts("Rs.270.74 IGST @18.0% :Rs.48.73 Rs.319.47");

    expect(reconcileAmounts(amounts)).toMatchObject({
      taxableValue: 270.74,
      igstAmount: 48.73,
      cgstAmount: 0,
      totalInvoiceValue: 319.47,
      gstRate: 18,
      basis: "inter-state",
    });
  });

  it("requires both halves to be printed before splitting a tax in two", () => {
    // Halving a tax that appears once would invent a CGST and an SGST the
    // document never stated.
    const amounts = collectAmounts("1000.00 180.00 1180.00");

    expect(reconcileAmounts(amounts)?.basis).toBe("inter-state");
  });

  it("lets the states decide when both splits fit", () => {
    const amounts = collectAmounts("1000.00 90.00 90.00 180.00 1180.00");

    expect(reconcileAmounts(amounts, { preferInterState: true })?.basis).toBe("inter-state");
    expect(reconcileAmounts(amounts, { preferInterState: false })?.basis).toBe("intra-state");
  });

  it("takes the invoice total, not a line that happens to fit", () => {
    // A single line reconciles too; the document's total is the larger one.
    const amounts = collectAmounts("500.00 25.00 25.00 550.00 10000.00 250.00 250.00 10500.00");

    expect(reconcileAmounts(amounts)?.totalInvoiceValue).toBe(10500);
  });

  it("refuses a rate the Act does not notify", () => {
    // 7% is not a slab, so these numbers are not a taxable value and a tax.
    expect(reconcileAmounts(collectAmounts("1000.00 70.00 1070.00"))).toBeNull();
  });

  it("returns nothing rather than inventing a split", () => {
    expect(reconcileAmounts(collectAmounts("Order 12,345 dated 01.02.2026"))).toBeNull();
    expect(reconcileAmounts([])).toBeNull();
  });
});

describe("deciding whether figures describe one invoice", () => {
  const base = {
    taxableValue: 1000,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    cessAmount: 0,
    totalInvoiceValue: 1180,
  };

  it("accepts figures that add up at a notified slab", () => {
    expect(amountsAreConsistent(base)).toBe(true);
  });

  it("tolerates a rounded-off rupee", () => {
    expect(amountsAreConsistent({ ...base, totalInvoiceValue: 1180.5 })).toBe(true);
  });

  it("rejects a total that does not follow", () => {
    // This is what a positional parser produces when its window slides: on a
    // thirteen-page invoice it read a CGST equal to the taxable value.
    expect(amountsAreConsistent({ ...base, cgstAmount: 1000, totalInvoiceValue: 0 })).toBe(false);
  });

  it("rejects an implied rate that is not a slab", () => {
    expect(
      amountsAreConsistent({ ...base, cgstAmount: 35, sgstAmount: 35, totalInvoiceValue: 1070 })
    ).toBe(false);
  });

  it("accepts a zero-rated supply", () => {
    // An export carries no tax, and that is not a failure to read one.
    expect(
      amountsAreConsistent({
        taxableValue: 5000,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
        totalInvoiceValue: 5000,
      })
    ).toBe(true);
  });

  it("rejects an empty reading", () => {
    expect(
      amountsAreConsistent({
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
        totalInvoiceValue: 0,
      })
    ).toBe(false);
  });
});
