import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  sheetGrid,
  looksLikeInvoiceDocument,
  labelledValue,
  labelledAmount,
  invoiceDocumentToTable,
} from "@/features/convert/engine/universal/excel-invoice-document";

const SELLER = "09BUXPG2404E1ZM";

/**
 * The shape a small seller's billing template has: a heading block whose
 * labels sit a row or two above their values, a short item list, and a
 * totals band. Blank rows are deliberate — the real files have them.
 */
function invoiceSheet(over: Partial<{ buyerGstin: string; discount: number }> = {}) {
  const rows: (string | number)[][] = [
    ["TAX INVOICE"],
    ["INNOVATIVE EXPORTS"],
    [`GSTIN- ${SELLER}`],
    [],
    ["Bill to:", "Place of Supply:", "", "", "INVOICE No-", "Dated"],
    [],
    ["BALAJI WOODEN HANDICRAFTS", "BALAJI WOODEN HANDICRAFTS"],
    ["ADDRESS: SHEGAON, BULDANA 444203", "", "", "", "2026-27/39", 46263],
    [`GSTIN No/AADHAR:- ${over.buyerGstin ?? "5277 2004 0872"}`],
    [],
    ["Description of Goods", "HSN CODE", "Units", "Qty.", "RATE", "Amount"],
    [],
    ['WOODEN REHAL 10"', "4421", "PCS", 100, 25, 2500],
    ['WOODEN REHAL 15"', "4421", "PCS", 65, 55, 3575],
    [],
    ["", "", "", 165, "", 6075],
    ["Less Discount", over.discount ?? 0],
    ["Taxable Value", 6075 - (over.discount ?? 0)],
    ["BANK DETAILS: STATE BANK OF INDIA"],
    ["ACCOUNT NUMBER: 37184165130", "ADD CGST: 2.5%", "-"],
    ["IFSC CODE: SBIN0001361", "ADD SGST: 2.5%", "-"],
    ["", "ADD IGST:5%", (6075 - (over.discount ?? 0)) * 0.05],
    ["Total Amount of Invoice", (6075 - (over.discount ?? 0)) * 1.05],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  return { sheet, grid: sheetGrid(sheet) };
}

describe("recognising a printed invoice", () => {
  it("knows a document from a register", () => {
    const { grid } = invoiceSheet();

    expect(looksLikeInvoiceDocument(grid, ["Description of Goods", "HSN CODE"])).toBe(true);
    // The same heading on a sheet that names its documents in a column is a
    // register of many, not one document.
    expect(looksLikeInvoiceDocument(grid, ["Invoice Number", "Invoice date"])).toBe(false);
  });
});

describe("reading a labelled cell", () => {
  it("takes the value beneath the label, not the next label beside it", () => {
    // "INVOICE No-" and "Dated" are neighbours on the heading row. Looking
    // rightwards first returned "Dated" as the invoice number on every file.
    const { grid } = invoiceSheet();

    expect(labelledValue(grid, /invoice\s*no\b/i, (c) => /\d/.test(c) && c.length <= 25)).toBe(
      "2026-27/39"
    );
    expect(labelledValue(grid, /bill\s*to/i)).toBe("BALAJI WOODEN HANDICRAFTS");
  });

  it("reads the amount off the label's own row", () => {
    const { grid } = invoiceSheet();

    expect(labelledAmount(grid, /^taxable\s*value/i)).toBe(6075);
    // A dash where a tax was not charged is not an amount.
    expect(labelledAmount(grid, /\bcgst\b/i)).toBe(0);
  });
});

describe("reading the invoice", () => {
  it("carries the number, date, buyer and goods into one table", () => {
    const { sheet } = invoiceSheet();
    const table = invoiceDocumentToTable("BILL NO. 10", sheet, "26-27(39).xlsx", SELLER)!;

    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]!["Invoice Number"]).toBe("2026-27/39");
    expect(table.rows[0]!["Invoice Date"]).toBe("2026-08-29");
    expect(table.rows[0]!["Item Description"]).toBe('WOODEN REHAL 10"');
  });

  it("stops the item list at the totals band", () => {
    // "Taxable Value" sits in the description column with the invoice total
    // beside it, and would otherwise be read as a commodity worth the lot.
    const { sheet } = invoiceSheet();
    const table = invoiceDocumentToTable("BILL NO. 10", sheet, "f.xlsx", SELLER)!;

    expect(table.rows.map((r) => r["Item Description"])).not.toContain("Taxable Value");
  });

  it("charges tax on what the invoice says it charged tax on", () => {
    // The item total is not the taxable value when a discount sits between
    // them. Taxing the item total gave a rate of 4.97% — no slab, and a line
    // the portal would refuse.
    const { sheet } = invoiceSheet({ discount: 75 });
    const table = invoiceDocumentToTable("BILL NO. 10", sheet, "f.xlsx", SELLER)!;

    const taxable = table.rows.reduce((sum, r) => sum + Number(r["Taxable Value (Rs)"]), 0);
    expect(Math.round(taxable)).toBe(6000);
    expect(Number(table.rows[0]!["GST Rate (%)"])).toBe(5);
  });

  it("puts an unregistered buyer's supply in the state its PIN names", () => {
    // The template prints an address with no state, and on an inter-state
    // sale to an unregistered buyer the PIN is the only evidence there is.
    const { sheet } = invoiceSheet();
    const table = invoiceDocumentToTable("BILL NO. 10", sheet, "f.xlsx", SELLER)!;

    expect(table.rows[0]!["Place of Supply"]).toBe("27-Maharashtra");
    expect(table.rows[0]!.Type).toBe("B2C");
  });

  it("reads the buyer's registration when there is one", () => {
    const { sheet } = invoiceSheet({ buyerGstin: "32AACCC6500A1ZM" });
    const table = invoiceDocumentToTable("BILL NO. 10", sheet, "f.xlsx", SELLER)!;

    expect(table.rows[0]!["Buyer GSTIN"]).toBe("32AACCC6500A1ZM");
    expect(table.rows[0]!.Type).toBe("B2B");
    expect(table.rows[0]!["Place of Supply"]).toBe("32-Kerala");
  });
});
