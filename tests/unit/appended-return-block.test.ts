import { describe, it, expect } from "vitest";
import {
  dropAppendedDuplicateReturns,
  flagUnreferencedRows,
} from "@/features/convert/engine/enrichment/appended-return-block";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    sourcePlatformId: "meesho",
    sourcePlatformName: "Meesho",
    sourceFileName: "tcs_sales.xlsx",
    transactionType: "Sales",
    invoiceNumber: "319542904425442881_2",
    invoiceDate: "2026-08-13",
    invoiceType: "B2CS",
    buyerName: "Customer",
    buyerGstin: "",
    placeOfSupply: "29",
    hsnCode: "442191",
    uqc: "PCS",
    quantity: 1,
    taxableValue: 146.67,
    igstRate: 5,
    cgstRate: 0,
    sgstRate: 0,
    cessRate: 0,
    igstAmount: 7.33,
    cgstAmount: 0,
    sgstAmount: 0,
    cessAmount: 0,
    totalValue: 154,
    errors: [],
    ...over,
  } as NormalizedInvoiceRow;
}

/** A credit note typed under the sales rows: no order reference of its own. */
const appended = (over: Partial<NormalizedInvoiceRow> = {}) =>
  row({ transactionType: "Return", invoiceType: "CDNCS", invoiceNumber: "", ...over });

/** The same credit note as Meesho exports it, carrying its order number. */
const fromReturnsFile = (over: Partial<NormalizedInvoiceRow> = {}) =>
  row({
    transactionType: "Return",
    invoiceType: "CDNCS",
    sourceFileName: "tcs_sales_return.xlsx",
    ...over,
  });

describe("returns an accountant typed under the sales export", () => {
  it("counts a credit note once when it also arrived in the returns file", () => {
    // The two copies share no reference — the typed one has none — so the
    // amount and the state are what identifies them as one document.
    const rows = [
      row({ taxableValue: 500 }),
      appended({ taxableValue: 143.81, placeOfSupply: "29" }),
      fromReturnsFile({ taxableValue: 143.81, placeOfSupply: "29" }),
    ];

    const { rows: kept, dropped } = dropAppendedDuplicateReturns(rows);

    expect(kept).toHaveLength(2);
    expect(dropped).toHaveLength(1);
    expect(kept.some((r) => r.sourceFileName === "tcs_sales_return.xlsx")).toBe(true);
  });

  it("always keeps the identified copy, whichever came first", () => {
    // A document must never be lost in favour of a hand-typed restatement.
    const reversed = [
      fromReturnsFile({ taxableValue: 143.81 }),
      appended({ taxableValue: 143.81 }),
    ];

    const { rows: kept } = dropAppendedDuplicateReturns(reversed);

    expect(kept).toHaveLength(1);
    expect(kept[0]!.invoiceNumber).not.toBe("");
  });

  it("keeps a typed credit note that has no counterpart", () => {
    // Uploading the sales file alone is normal, and then the typed rows are
    // the only record of those credit notes. Dropping them lost every one.
    const rows = [row({}), appended({ taxableValue: 143.81 })];

    expect(dropAppendedDuplicateReturns(rows).rows).toHaveLength(2);
  });

  it("keeps a typed adjustment that is not the same document", () => {
    // Real case: an order shows a −2.86 adjustment in the sales file and a
    // −143.81 return in the returns file. Both are real, and both belong.
    const rows = [
      appended({ taxableValue: 2.86, placeOfSupply: "29" }),
      fromReturnsFile({ taxableValue: 143.81, placeOfSupply: "29" }),
    ];

    expect(dropAppendedDuplicateReturns(rows).rows).toHaveLength(2);
  });

  it("does not collapse two credit notes onto one reported document", () => {
    // Each identified note may absorb at most one typed copy, or a genuine
    // pair of equal returns would silently become one.
    const rows = [
      appended({ taxableValue: 100 }),
      appended({ taxableValue: 100 }),
      fromReturnsFile({ taxableValue: 100 }),
    ];

    const { rows: kept, dropped } = dropAppendedDuplicateReturns(rows);

    expect(dropped).toHaveLength(1);
    expect(kept).toHaveLength(2);
  });

  it("does not match across states", () => {
    const rows = [
      appended({ taxableValue: 143.81, placeOfSupply: "29" }),
      fromReturnsFile({ taxableValue: 143.81, placeOfSupply: "27" }),
    ];

    expect(dropAppendedDuplicateReturns(rows).rows).toHaveLength(2);
  });

  it("leaves sales alone, referenced or not", () => {
    const rows = [row({}), row({ invoiceNumber: "" })];

    expect(dropAppendedDuplicateReturns(rows).rows).toHaveLength(2);
  });

  it("does nothing when no identified return exists", () => {
    const rows = [appended({ taxableValue: 143.81 })];

    expect(dropAppendedDuplicateReturns(rows).rows).toBe(rows);
  });
});

describe("flagging what was taken on trust", () => {
  it("marks a typed row so the user can see it came from the spreadsheet", () => {
    const [sale, note] = flagUnreferencedRows([
      row({ invoiceNumber: "" }),
      appended({ taxableValue: 143.81 }),
    ]);

    expect(sale!.reviews?.[0]).toMatch(/counted as a supply/i);
    expect(note!.reviews?.[0]).toMatch(/no matching entry in a returns file/i);
  });

  it("leaves a row Meesho itself exported unmarked", () => {
    expect(flagUnreferencedRows([row({})])[0]!.reviews ?? []).toHaveLength(0);
  });
});
