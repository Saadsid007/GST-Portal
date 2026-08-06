import { describe, expect, it } from "vitest";
import {
  DEMO_ROWS,
  DEMO_SELLER,
  DEMO_TOTALS,
  GSTR1_ROWS,
  RAW_ROWS,
} from "@/features/demo/demo-data";

/**
 * The homepage demo shows real figures to people who file GST for a living.
 * If the arithmetic does not reconcile, the demo actively damages trust — so
 * it is asserted rather than eyeballed.
 */
describe("homepage demo dataset", () => {
  it("reconciles taxable + tax against the gross total", () => {
    expect(DEMO_TOTALS.netTaxable + DEMO_TOTALS.totalTax).toBeCloseTo(DEMO_TOTALS.grossValue, 2);
  });

  it("splits tax by place of supply against the seller's own state", () => {
    for (const row of DEMO_ROWS) {
      const intra = row.placeOfSupply === DEMO_SELLER.stateCode;
      if (intra) {
        expect(row.igstAmount, `${row.invoiceNumber} is intra-state`).toBe(0);
        expect(row.cgstAmount).toBeGreaterThan(0);
        expect(row.cgstAmount).toBeCloseTo(row.sgstAmount, 2);
      } else {
        expect(row.cgstAmount, `${row.invoiceNumber} is inter-state`).toBe(0);
        expect(row.sgstAmount).toBe(0);
        expect(row.igstAmount).toBeGreaterThan(0);
      }
    }
  });

  it("computes every line's tax from its own rate and taxable value", () => {
    for (const row of DEMO_ROWS) {
      const rate = row.igstRate || row.cgstRate + row.sgstRate;
      const tax = row.igstAmount + row.cgstAmount + row.sgstAmount;
      expect(tax, row.invoiceNumber).toBeCloseTo(row.taxableValue * (rate / 100), 2);
      expect(row.totalValue).toBeCloseTo(row.taxableValue + tax, 2);
    }
  });

  it("carries ten raw lines and no filing-blocking errors", () => {
    expect(RAW_ROWS).toHaveLength(10);
    expect(DEMO_TOTALS.rawLineCount).toBe(10);
    expect(DEMO_ROWS.every((r) => r.errors.length === 0)).toBe(true);
  });

  it("groups B2CS rows without losing value", () => {
    const grouped = GSTR1_ROWS.reduce((t, g) => t + g.taxableValue, 0);
    expect(grouped).toBeCloseTo(DEMO_TOTALS.netTaxable, 2);
  });
});
