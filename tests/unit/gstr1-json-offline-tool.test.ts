import { describe, expect, it } from "vitest";

import {
  generateGstr1Json,
  OFFLINE_TOOL_VERSION,
} from "@/features/convert/domain/gstr1-json.generator";
import { validateInvoices } from "@/features/convert/domain/validator";
import type {
  ConversionSummary,
  NormalizedInvoiceRow,
} from "@/features/convert/types/convert.types";

/**
 * The JSON the portal accepts is the one the GST Returns Offline Tool writes.
 * Every expectation here was read from the tool itself (gst.gov.in, V3.2.4):
 * the envelope in `formDataFormat`, the sections in its Excel import.
 */

const SUPPLIER = "09AFVPF7479N1Z9";
const BUYER = "27AAACG3997K1Z3";

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: "r",
    rowIndex: 2,
    invoiceNumber: "IN-1",
    invoiceDate: "2026-09-01",
    invoiceType: "B2B",
    buyerName: "Buyer",
    buyerGstin: BUYER,
    placeOfSupply: "27",
    hsnCode: "732690",
    uqc: "NOS",
    quantity: 1,
    taxableValue: 1000,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 5,
    cessRate: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 50,
    cessAmount: 0,
    totalValue: 1050,
    transactionType: "Sales",
    errors: [],
    ...over,
  };
}

function json(rows: NormalizedInvoiceRow[]) {
  return JSON.parse(generateGstr1Json(rows, SUPPLIER, "092026", {} as ConversionSummary));
}

describe("the file the GST Returns Offline Tool writes", () => {
  it("carries the tool's current release, or the portal turns it away as old", () => {
    expect(OFFLINE_TOOL_VERSION).toBe("GST3.2.4");
    expect(json([row({})]).version).toBe("GST3.2.4");
  });

  it("writes an invoice of two rates once, with an item per rate numbered rate × 100 + 1", () => {
    const out = json([
      row({}),
      row({ hsnCode: "940360", igstRate: 18, igstAmount: 180, totalValue: 1180 }),
    ]);
    const invoices = out.b2b[0].inv;
    expect(invoices).toHaveLength(1);
    expect(invoices[0].val).toBe(2230);
    expect(invoices[0].itms.map((i: { num: number }) => i.num)).toEqual([501, 1801]);
  });

  it("writes CGST and SGST as equal halves for a supply within the state", () => {
    const out = json([
      row({
        buyerGstin: "09DREPM2884N1Z0",
        placeOfSupply: "09",
        igstRate: 0,
        igstAmount: 0,
        cgstRate: 2.5,
        sgstRate: 2.5,
        cgstAmount: 25,
        sgstAmount: 25,
      }),
    ]);
    expect(out.b2b[0].inv[0].itms[0].itm_det).toEqual({
      txval: 1000,
      rt: 5,
      camt: 25,
      samt: 25,
      csamt: 0,
    });
  });

  it("writes a credit note to a business as the delinked schema has it", () => {
    const out = json([
      row({ invoiceType: "CDNR", invoiceNumber: "CN-348", transactionType: "Return" }),
    ]);
    const note = out.cdnr[0].nt[0];
    expect(Object.keys(note).sort()).toEqual(
      ["inv_typ", "itms", "nt_dt", "nt_num", "ntty", "pos", "rchrg", "val"].sort()
    );
    expect(note).toMatchObject({ ntty: "C", pos: "27", rchrg: "N", inv_typ: "R" });
  });

  it("types an unregistered note as one of the tool's three kinds", () => {
    const out = json([
      row({
        invoiceType: "CDNCS",
        buyerGstin: "",
        invoiceNumber: "CN-9",
        transactionType: "Return",
        taxableValue: 200000,
        igstAmount: 10000,
        totalValue: 210000,
      }),
    ]);
    expect(out.cdnur).toHaveLength(1);
    for (const note of out.cdnur) {
      expect(note.typ).toBe("B2CL");
      expect(note).not.toHaveProperty("rsn");
      expect(note).not.toHaveProperty("p_gst");
    }
  });

  it("leaves Table 14 without the flag the tool never writes", () => {
    const out = json([row({ ecoGstin: "09AAICA3918J1CR", sourcePlatformId: "amazon" })]);
    expect(out.supeco.clttx[0]).not.toHaveProperty("flag");
  });

  it("reports a service in Table 12 with unit NA and no quantity", () => {
    const out = json([row({ hsnCode: "998346", uqc: "OTH", quantity: 3 })]);
    expect(out.hsn.hsn_b2b[0]).toMatchObject({ hsn_sc: "998346", uqc: "NA", qty: 0 });
  });

  it("reports a unit outside the tool's list as OTH", () => {
    const out = json([row({ uqc: "UNI" })]);
    expect(out.hsn.hsn_b2b[0].uqc).toBe("OTH");
  });
});

describe("document numbers the tool accepts", () => {
  it("refuses a B2B number with a character outside letters, digits, - and /", () => {
    const [bad] = validateInvoices([row({ invoiceNumber: "721409_1" })], SUPPLIER).rows;
    expect(bad!.errors.join(" ")).toMatch(/character the portal refuses/);
    const [ok] = validateInvoices([row({ invoiceNumber: "RCL/177/2026-27" })], SUPPLIER).rows;
    expect(ok!.errors.join(" ")).not.toMatch(/character the portal refuses/);
  });
});
