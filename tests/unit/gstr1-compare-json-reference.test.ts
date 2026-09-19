import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { compareGstr1InBrowser } from "@/features/convert/engine/comparison/compare-in-browser";
import { toComparableRow } from "@/features/convert/engine/comparison/gstr1.comparator";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * The portal's own JSON is the strongest reference there is — it is what was
 * filed — but the comparison could not read one from the UI: the file picker
 * offered only .xlsx and .xls, so the parser's JSON support was unreachable.
 * Both files were also labelled "Government GSTR-1 Template V2.1", so a user
 * could not tell the filed return from an accountant's working draft.
 */
const FILED_JSON = JSON.stringify({
  gstin: "09BHCPS1644C1ZI",
  fp: "082026",
  b2b: [
    {
      ctin: "23BZCPS7014Q1ZY",
      inv: [
        {
          inum: "IN-1259",
          idt: "27-08-2026",
          val: 298,
          pos: "23",
          itms: [{ num: 1, itm_det: { txval: 283.81, rt: 5, iamt: 14.19, csamt: 0 } }],
        },
      ],
    },
  ],
  b2cs: [{ sply_ty: "INTER", rt: 5, typ: "OE", pos: "27", txval: 1000, iamt: 50, csamt: 0 }],
});

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    transactionType: "Sales",
    invoiceNumber: "IN-1259",
    invoiceDate: "2026-08-27",
    invoiceType: "B2B",
    buyerName: "Buyer",
    buyerGstin: "23BZCPS7014Q1ZY",
    placeOfSupply: "23",
    hsnCode: "441900",
    quantity: 1,
    taxableValue: 283.81,
    igstRate: 5,
    cgstRate: 0,
    sgstRate: 0,
    cessRate: 0,
    igstAmount: 14.19,
    cgstAmount: 0,
    sgstAmount: 0,
    cessAmount: 0,
    totalValue: 298,
    errors: [],
    ...over,
  } as NormalizedInvoiceRow;
}

function jsonFile(body: string, name = "GSTR1_09BHCPS1644C1ZI_August_2026-2027.json"): File {
  return new File([body], name, { type: "application/json" });
}

describe("comparing against the JSON filed on the portal", () => {
  it("reads it and reconciles the invoices", async () => {
    const result = await compareGstr1InBrowser([toComparableRow(row({}))], jsonFile(FILED_JSON));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.matchedCount).toBe(1);
    expect(result.data.mismatchCount).toBe(0);
    expect(result.data.onlyInOursCount).toBe(0);
  });

  it("names it as the filed return, not as a template", async () => {
    // Both were shown as "Government GSTR-1 Template V2.1", so a difference
    // against a working draft looked identical to one against the real thing.
    const result = await compareGstr1InBrowser([toComparableRow(row({}))], jsonFile(FILED_JSON));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sourceLabel).toMatch(/filed on the portal/i);
  });

  it("reports an invoice the filed return does not carry", async () => {
    const stranger = row({ invoiceNumber: "IN-9999", buyerGstin: "23BZCPS7014Q1ZY" });

    const result = await compareGstr1InBrowser(
      [toComparableRow(row({})), toComparableRow(stranger)],
      jsonFile(FILED_JSON)
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.onlyInOursCount).toBe(1);
  });

  it("says so when the JSON holds no GSTR-1 data", async () => {
    const result = await compareGstr1InBrowser([toComparableRow(row({}))], jsonFile("{}"));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/no gstr-1 data/i);
  });
});

/**
 * Against the real filed return in the corpus, where the same invoice sits in
 * B2B — the accountant's working workbook still had it in B2CS.
 */
const REAL_FILED =
  "Sample/new 25/ALM AUG 2026 WORK/GSTR1_09BHCPS1644C1ZI_August_2026-2027_1789021460820.json";

describe.skipIf(!existsSync(REAL_FILED))("against a real filed return", () => {
  it("finds the invoice the working draft had misfiled", async () => {
    const result = await compareGstr1InBrowser(
      [toComparableRow(row({}))],
      jsonFile(readFileSync(REAL_FILED, "utf8"))
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    // IN-1259 is in the filed return's B2B; it is absent from the workbook.
    expect(result.data.onlyInOursCount).toBe(0);
    expect(result.data.matchedCount).toBe(1);
  });
});
