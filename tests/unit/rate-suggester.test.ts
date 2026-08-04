import { describe, expect, it } from "vitest";

import {
  isConfidentSuggestion,
  RATE_CONFIDENCE_THRESHOLD,
  suggestGstRate,
} from "@/features/convert/engine/error-center/rate-suggester";
import { applyRateToRow } from "@/features/convert/engine/error-center/revalidate";
import { validateInvoices } from "@/features/convert/domain/validator";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: "r",
    rowIndex: 2,
    invoiceNumber: "INV1",
    invoiceDate: "2026-05-01",
    invoiceType: "B2CS",
    buyerName: "Customer",
    buyerGstin: "",
    placeOfSupply: "27",
    hsnCode: "610910",
    quantity: 1,
    taxableValue: 1000,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 0,
    cessRate: 0,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    cessAmount: 0,
    totalValue: 1180,
    transactionType: "Sales",
    errors: [],
    ...over,
  };
}

const rateless = { cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmount: 0, sgstAmount: 0 };

describe("suggestGstRate", () => {
  it("takes the rate its own HSN already carries elsewhere", () => {
    const target = row({ id: "t", ...rateless });
    const out = suggestGstRate(target, [target, row({ id: "a" }), row({ id: "b" })]);

    expect(out?.rate).toBe(18);
    expect(out?.source).toBe("HSN");
    expect(out?.sampleSize).toBe(2);
  });

  it("holds a unanimous but tiny sample below the auto-apply threshold", () => {
    const target = row({ id: "t", ...rateless });

    // One agreeing row is unanimous, but one row is not evidence — it must not auto-apply.
    const single = suggestGstRate(target, [target, row({ id: "a" })]);
    expect(single?.confidence).toBeLessThan(RATE_CONFIDENCE_THRESHOLD);
    expect(isConfidentSuggestion(single)).toBe(false);

    const two = suggestGstRate(target, [target, row({ id: "a" }), row({ id: "b" })]);
    expect(two?.confidence).toBeLessThan(RATE_CONFIDENCE_THRESHOLD);
  });

  it("clears the threshold once enough rows agree", () => {
    const target = row({ id: "t", ...rateless });
    const peers = Array.from({ length: 6 }, (_, i) => row({ id: `p${i}` }));
    const out = suggestGstRate(target, [target, ...peers]);

    expect(out?.confidence).toBe(100);
    expect(isConfidentSuggestion(out)).toBe(true);
  });

  it("reports agreement, not certainty, when the HSN carries mixed rates", () => {
    const target = row({ id: "t", ...rateless });
    const out = suggestGstRate(target, [
      target,
      row({ id: "a" }),
      row({ id: "b" }),
      row({ id: "c", cgstRate: 2.5, sgstRate: 2.5 }),
    ]);

    expect(out?.rate).toBe(18);
    expect(out?.confidence).toBe(67);
    expect(isConfidentSuggestion(out)).toBe(false);
  });

  it("falls back to matching item descriptions when the HSN has no peers", () => {
    const target = row({
      id: "t",
      hsnCode: "999999",
      itemDescription: "Cotton T-Shirt",
      ...rateless,
    });
    const peers = Array.from({ length: 6 }, (_, i) =>
      row({ id: `p${i}`, hsnCode: "610910", itemDescription: "cotton t-shirt " })
    );
    const out = suggestGstRate(target, [target, ...peers]);

    expect(out?.rate).toBe(18);
    expect(out?.source).toBe("DESCRIPTION");
    // Capped below a pure HSN match — a shared description is the weaker signal.
    expect(out?.confidence).toBeGreaterThanOrEqual(RATE_CONFIDENCE_THRESHOLD);
    expect(out?.confidence).toBeLessThan(100);
  });

  it("stays silent when no other row shares the HSN or description", () => {
    const target = row({ id: "t", hsnCode: "999999", ...rateless });

    expect(suggestGstRate(target, [target, row({ id: "a" })])).toBeNull();
  });

  it("stays silent for a row that already has a rate", () => {
    const target = row({ id: "t" });

    expect(suggestGstRate(target, [target, row({ id: "a" })])).toBeNull();
  });

  it("stays silent when the row has no HSN to match on", () => {
    const target = row({ id: "t", hsnCode: "", ...rateless });

    expect(suggestGstRate(target, [target, row({ id: "a" })])).toBeNull();
  });
});

describe("applyRateToRow", () => {
  it("clears the stored suggestion once the row carries a rate of its own", () => {
    // The suggestion used to be spread onto the row only when present, so revalidating after an
    // applied rate left the previous pass's hint in place and the "rows have a suggested rate"
    // banner never went away.
    const target = row({ id: "t", ...rateless });
    const peers = [target, row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];

    const first = validateInvoices(peers, "27AABCU9603R1ZM");
    expect(first.rows.find((r) => r.id === "t")?.suggestedGstRate?.rate).toBe(18);

    const applied = first.rows.map((r) => (r.id === "t" ? applyRateToRow(r, 18, "27") : r));
    const second = validateInvoices(applied, "27AABCU9603R1ZM");

    expect(second.rows.find((r) => r.id === "t")?.suggestedGstRate).toBeUndefined();
  });

  const rateless = { cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmount: 0, sgstAmount: 0 };

  it("derives the tax amounts so an applied rate does not create a mismatch error", () => {
    // Applying only the rate used to leave the row's zero tax amounts intact, which traded the
    // missing-rate error for a CGST-mismatch error.
    const applied = applyRateToRow(row({ id: "t", placeOfSupply: "27", ...rateless }), 18, "27");

    expect(applied.cgstRate).toBe(9);
    expect(applied.cgstAmount).toBe(90);
    expect(applied.sgstAmount).toBe(90);
    expect(validateInvoices([applied], "27AABCU9603R1ZM").errorCount).toBe(0);
  });

  it("puts an inter-state rate in the IGST bucket", () => {
    const applied = applyRateToRow(row({ id: "t", placeOfSupply: "29", ...rateless }), 18, "27");

    expect(applied.igstRate).toBe(18);
    expect(applied.igstAmount).toBe(180);
    expect(applied.cgstAmount).toBe(0);
  });

  it("keeps a return's tax negative", () => {
    const applied = applyRateToRow(
      row({ id: "t", placeOfSupply: "27", taxableValue: -1000, totalValue: -1180, ...rateless }),
      18,
      "27"
    );

    expect(applied.cgstAmount).toBe(-90);
  });
});
