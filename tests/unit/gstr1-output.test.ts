import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { generateGstr1Excel } from "@/features/convert/domain/gstr1-excel.generator";
import { generateGstr1Json } from "@/features/convert/domain/gstr1-json.generator";
import type {
  ConversionSummary,
  NormalizedInvoiceRow,
} from "@/features/convert/types/convert.types";

const SUPPLIER_GSTIN = "09AABCS1234A1Z5";
const AMAZON_ECO = "09AAACA4872N1Z5";
const MEESHO_ECO = "09AARCM9332R1CM";

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: "r",
    rowIndex: 2,
    invoiceNumber: "INV1",
    invoiceDate: "2026-05-01",
    invoiceType: "B2CS",
    buyerName: "Customer",
    buyerGstin: "",
    placeOfSupply: "09",
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

/** Reads a generated sheet back as objects starting from header row 4 (0-indexed 3) */
async function sheet(rows: NormalizedInvoiceRow[], name: string): Promise<Record<string, unknown>[]> {
  const buf = await generateGstr1Excel(rows, SUPPLIER_GSTIN, "052026");
  const wb = XLSX.read(buf, { type: "buffer" });
  return XLSX.utils.sheet_to_json(wb.Sheets[name]!, { range: 3 });
}

function json(rows: NormalizedInvoiceRow[]) {
  return JSON.parse(generateGstr1Json(rows, SUPPLIER_GSTIN, "052026", {} as ConversionSummary));
}

describe("B2CS supply type", () => {
  it("marks an out-of-state consolidated row as INTER, not INTRA", () => {
    const out = json([
      row({ id: "a", placeOfSupply: "09", cgstAmount: 90, sgstAmount: 90 }),
      row({
        id: "b",
        placeOfSupply: "27",
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 18,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 180,
      }),
    ]);

    const byPos = new Map(
      out.b2cs.map((b: { pos: string; sply_ty: string }) => [b.pos, b.sply_ty])
    );
    expect(byPos.get("09")).toBe("INTRA");
    expect(byPos.get("27")).toBe("INTER");
  });
});

describe("HSN summary nets credit notes", () => {
  const rows = [
    row({ id: "s", taxableValue: 1000, cgstAmount: 90, sgstAmount: 90 }),
    row({
      id: "c",
      invoiceType: "CDNCS",
      transactionType: "Return",
      taxableValue: -400,
      cgstAmount: -36,
      sgstAmount: -36,
      totalValue: -472,
    }),
  ];

  it("subtracts the credit note instead of adding its absolute value", () => {
    const hsnData = json(rows).hsn.hsn_b2c;

    expect(hsnData).toHaveLength(1);
    expect(hsnData[0].txval).toBe(600);
    expect(hsnData[0].camt).toBe(54);
  });

  it("reports the same net figures in the Excel HSN sheet", async () => {
    const hsn = await sheet(rows, "hsn(b2c)");

    expect(hsn).toHaveLength(1);
    expect(hsn[0]!["Taxable Value"]).toBe(600);
  }, 15000);
});

describe("Table 14(a) e-commerce operator summary", () => {
  const rows = [
    row({
      id: "a1",
      ecoGstin: AMAZON_ECO,
      ecoName: "Amazon",
      taxableValue: 2000,
      cgstAmount: 180,
      sgstAmount: 180,
    }),
    row({
      id: "a2",
      ecoGstin: AMAZON_ECO,
      ecoName: "Amazon",
      invoiceType: "CDNCS",
      transactionType: "Return",
      taxableValue: -500,
      cgstAmount: -45,
      sgstAmount: -45,
    }),
    row({
      id: "m1",
      ecoGstin: MEESHO_ECO,
      ecoName: "Meesho",
      taxableValue: 1200,
      cgstAmount: 108,
      sgstAmount: 108,
    }),
    row({ id: "d1", taxableValue: 700, cgstAmount: 63, sgstAmount: 63, sourcePlatformId: "offline" }),
  ];

  it("groups by operator GSTIN and nets returns against sales in JSON", () => {
    const supeco = json(rows).supeco || json(rows).eco;
    const clttx = supeco?.clttx || [];

    expect(clttx.length).toBeGreaterThanOrEqual(1);
    const byEtin = new Map(
      clttx.map((e: { etin: string; suppval: number }) => [e.etin, e.suppval])
    );
    expect(byEtin.get(MEESHO_ECO)).toBe(1200);
  });

  it("lists the operator name in the ECO sheet for reporting", async () => {
    const eco = await sheet(rows, "eco");

    expect(eco.map((e) => e["E-Commerce Operator Name"]).sort()).toEqual(["Amazon", "Meesho"]);
  }, 15000);
});

describe("document series", () => {
  const rows = [
    row({ id: "i1", invoiceNumber: "INV001" }),
    row({ id: "i2", invoiceNumber: "INV002" }),
    row({
      id: "c1",
      invoiceNumber: "CN001",
      invoiceType: "CDNR",
      transactionType: "Return",
      taxableValue: -100,
      cgstAmount: -9,
      sgstAmount: -9,
    }),
  ];

  it("reports invoices and credit notes as separate series in the DOCS sheet", async () => {
    const docs = await sheet(rows, "docs");

    expect(docs).toHaveLength(2);
    expect(docs[0]!["Nature of Document"]).toBe("Invoices for outward supply");
    expect(docs[0]!["Total Number"]).toBe(2);
    expect(docs[1]!["Nature of Document"]).toBe("Credit Note");
    expect(docs[1]!["Total Number"]).toBe(1);
  }, 15000);

  it("does not fold credit notes into the invoice count in doc_issue", () => {
    const det = json(rows).doc_issue.doc_det;

    expect(det).toHaveLength(2);
    expect(det[0].docs[0].totnum).toBe(2);
    expect(det[0].docs[0].from).toBe("INV001");
    expect(det[1].docs[0].totnum).toBe(1);
  });
});

describe("HSN description and unit", () => {
  it("carries the source description and unit instead of a blank cell and OTH", async () => {
    const hsn = await sheet([row({ id: "s", itemDescription: "Cotton T-Shirt", uqc: "PCS" })], "hsn(b2c)");

    expect(hsn[0]!.Description).toBe("Cotton T-Shirt");
    expect(hsn[0]!.UQC).toBe("PCS-PIECES");
  }, 15000);

  it("keeps different units on the same HSN as separate rows", async () => {
    const hsn = await sheet(
      [
        row({ id: "a", uqc: "PCS", taxableValue: 1000 }),
        row({ id: "b", uqc: "KGS", taxableValue: 500, cgstAmount: 45, sgstAmount: 45 }),
      ],
      "hsn(b2c)"
    );

    expect(hsn).toHaveLength(2);
    expect(hsn.map((h) => h.UQC).sort()).toEqual(["KGS-KGS", "PCS-PIECES"]);
  }, 15000);

  it("falls back to default UQC when the source carries no unit", () => {
    const out = json([row({})]);
    expect(out.hsn.hsn_b2c[0].uqc).toBeDefined();
  });
});
