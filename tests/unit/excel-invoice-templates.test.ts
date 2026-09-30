import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { readInvoiceSheet } from "@/features/convert/engine/universal/excel-invoice-document";
import { reconstructWorkbook } from "@/features/convert/engine/universal/table-reconstructor";
import { OfflineInvoicesAdapter } from "@/features/convert/engine/adapters/offline-invoices.adapter";
import { extractInvoiceFromText } from "@/features/pdf-extractor/engine/regex-invoice-extractor";

const SELLER = "07AANCM6581E1Z5";

type Cell = string | number;

/** A row laid out at the columns a template spreads it over. */
function at(cells: Record<number, Cell>): Cell[] {
  const row: Cell[] = [];
  for (const [col, value] of Object.entries(cells)) row[Number(col)] = value;
  return Array.from(row, (value) => value ?? "");
}

/**
 * A calibration lab's template: labels down column A with values to the
 * right, goods columns spread over merged cells, charges and a one-line tax
 * statement under the goods, and a hand-edited breakdown box below that.
 */
function labSheet(over: {
  number?: string;
  buyerGstin?: string;
  address?: string;
  charges?: [string, number];
  tax: [string, number];
  box: [string, number][];
}) {
  const rows: Cell[][] = [
    at({ 4: "REALTECH CALIBRATION LAB (OPC) PVT. LTD" }),
    at({ 4: `GSTIN/UIN: ${SELLER}` }),
    at({ 0: "Invoice No.:", 5: over.number ?? "RCL/112/2026-27", 11: "Mode/Terms of Payment:" }),
    at({ 0: "Invoice Date:", 5: "07/07/2026", 11: "Customer Order No.:" }),
    at({ 0: "Other References:", 11: "Customer Order Date:" }),
    at({ 0: "Consignee", 11: "Buyer (if other than consignee)" }),
    at({ 0: "Name:", 3: "M/S Buyer" }),
    at({ 0: "Address:", 3: over.address ?? "Safdarjung Enclave, New Delhi 110029" }),
    at({ 0: "GSTIN/UIN:", 3: over.buyerGstin ?? "----" }),
    at({
      0: "S No.",
      1: "Description of Goods/Service",
      8: "SAC",
      10: "GST Rate %",
      12: "Quantity",
      13: "Rate",
      18: "Amount in Rs.",
    }),
    at({ 0: 1, 1: "Blood Roller Mixer", 8: 998346, 10: 18, 12: 1, 13: 500, 18: 500 }),
    at({ 0: 2, 1: "Dig. Thermometer", 8: 998346, 10: 18, 12: 1, 13: 1247, 18: 1247 }),
    at({ 0: 3 }),
    at({ 0: "Total Quantity", 12: 2, 13: "Total Chargable in Rs. =", 18: 1747 }),
    ...(over.charges ? [at({ 0: over.charges[0], 18: over.charges[1] })] : []),
    at({ 0: over.tax[0], 18: over.tax[1] }),
    at({ 0: "SAC", 6: "Taxable Value", 15: "Integrated Tax" }),
    ...over.box.map(([label, amount]) => at({ 0: 998346, 6: 1747, 10: label, 15: 9, 18: amount })),
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

describe("a template that labels down a column and values to the right", () => {
  it("reads the number beside its label, not the next label below it", () => {
    const invoice = readInvoiceSheet(
      labSheet({ tax: ["Tax 18%=", 314.46], box: [["CGST", 157.23]] }),
      "112.xlsx",
      SELLER
    )!;

    expect(invoice.invoiceNumber).toBe("RCL/112/2026-27");
    expect(invoice.invoiceDate).toBe("2026-07-07");
    expect(invoice.lineItems.map((l) => l.hsnCode)).toEqual(["998346", "998346"]);
    expect(invoice.lineItems.map((l) => l.quantity)).toEqual([1, 1]);
  });

  it("adds the charges billed with the goods to the taxable value", () => {
    // 404.46 is 18% of 2,247 — goods 1,747 plus site charges 500.
    const invoice = readInvoiceSheet(
      labSheet({
        charges: ["Site charges=", 500],
        tax: ["Tax 18%=", 404.46],
        box: [["CGST", 202.23]],
      }),
      "112.xlsx",
      SELLER
    )!;

    expect(invoice.taxableValue).toBe(2247);
    expect(invoice.gstRate).toBe(18);
    expect(invoice.lineItems.reduce((s, l) => s + l.taxableValue, 0)).toBeCloseTo(2247, 2);
  });

  it("takes the net after a discount line", () => {
    const invoice = readInvoiceSheet(
      labSheet({
        charges: ["after 20% Discount=", 1397.6],
        tax: ["Tax 18%=", 251.57],
        box: [["CGST", 125.78]],
      }),
      "130.xlsx",
      SELLER
    )!;

    expect(invoice.taxableValue).toBe(1397.6);
  });

  it("trusts the stated tax over a breakdown box copied from another bill", () => {
    // The box says "CGST 9%" twice for a supply to Uttar Pradesh; the law
    // makes it IGST, and the one-line statement has the whole amount.
    const invoice = readInvoiceSheet(
      labSheet({
        number: "CN-07",
        buyerGstin: "09AAKCD7140D1ZQ",
        tax: ["Tax 18%=", 314.46],
        box: [
          ["CGST", 157.23],
          ["CGST", 157.23],
        ],
      }),
      "111-DRG Note Credit.xlsx",
      SELLER
    )!;

    expect(invoice.igstAmount).toBe(314.46);
    expect(invoice.cgstAmount).toBe(0);
    expect(invoice.notes.join(" ")).toMatch(/reported as IGST/);
  });

  it("knows a CN-numbered document for a credit note, whatever the file is called", () => {
    const invoice = readInvoiceSheet(
      labSheet({
        number: "CN-11",
        buyerGstin: "07ABBCS0655G1ZI",
        tax: ["GST 18 %  =", 314.46],
        box: [["CGST", 157.23]],
      }),
      "117-SHAGUN CARES INDIA PRIVATE LIMITED.xlsx",
      SELLER
    )!;

    expect(invoice.documentType).toBe("Credit Note");
    expect(invoice.classification).toBe("CDNR");
  });

  it("keeps a buyer GSTIN typed wrong, so the error reaches the user", () => {
    const invoice = readInvoiceSheet(
      labSheet({
        buyerGstin: "09AASCM4127D12C",
        tax: ["GST 18% =", 314.46],
        box: [["IGST", 314.46]],
      }),
      "120.xlsx",
      SELLER
    )!;

    expect(invoice.buyerGstin).toBe("09AASCM4127D12C");
    expect(invoice.classification).toBe("B2B");
  });
});

describe("a template with the value on the label's row and no HSN typed", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["TAX INVOICE"],
    ["GSTIN NO.   09AFVPF7479N1Z9"],
    ["Inovice No.                         :", "", 2],
    ["Date of Invoice                 :", "", 46203],
    ["Place of Supply                 :"],
    ["NAME                     :", "", "ROYAL HANDICRAFTS"],
    ["GSTIN NO.            :", "", "09CSFPM8838R1ZK"],
    ["S.N.", "PARTICULARS", "", "", "", "", "HSN", "QTY", "RATE", "AMOUNT"],
    [1, "PARCEL 500 GRAME", "", "", "", "", "", 466, 65, 30290],
    [2, "", "", "", "", "", "", "", "", 0],
    ["IS GST PAYBALE ON REVERSE CHARGES", "", "", "", "", "", "TOTAL", "", "", 30290],
    ["", "", "", "", "", "", "CGST @  9%", "", "", 2726.1],
    ["", "", "", "", "", "", "SGST @  9%", "", "", 2726.1],
  ]);

  it("reads the bill and leaves the missing code for the validator", () => {
    const invoice = readInvoiceSheet(sheet, "BILL MNH ART TO ROYAL 2.xlsx")!;

    expect(invoice.invoiceNumber).toBe("2");
    expect(invoice.buyerName).toBe("ROYAL HANDICRAFTS");
    expect(invoice.taxableValue).toBe(30290);
    expect(invoice.cgstAmount).toBe(2726.1);
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.lineItems[0]!.hsnCode).toBe("");
  });
});

describe("a workbook that is one printed invoice", () => {
  it("reads nothing from the template's scratch sheets", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      labSheet({ tax: ["Tax 18%=", 314.46], box: [["CGST", 157.23]] }),
      "Sheet2"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["", 0, "", "", "", 998346, "", 18, "", "", 500, "", "", 0],
        ["", 0, "", "", "", 998346, "", 18, "", "", 350, "", "", 0],
        ["", 0, "", "", "", 998346, "", 18, "", "", 350, "", "", 0],
      ]),
      "Chart1"
    );

    const tables = reconstructWorkbook(workbook, "134.xlsx", SELLER);
    expect(tables.map((t) => t.sheetName)).toEqual(["Invoice_Line_Items (Sheet2)"]);
  });
});

describe("a credit note read from an invoice file", () => {
  const context = {
    marketplace: "OFFLINE",
    sourceId: "o",
    fileId: "cn.xlsx",
    fileName: "cn.xlsx",
    sourceRow: 0,
    sheetName: "Invoice_Line_Items",
    reportType: "offline_invoices",
    supplierGstin: SELLER,
  };
  const row = (over: Record<string, string>) => ({
    "Invoice Number": "CN-07",
    "Invoice Date": "2026-07-06",
    "Document Type": "Credit Note",
    "Buyer GSTIN": "09AAKCD7140D1ZQ",
    "Place of Supply": "",
    "HSN/SAC Code": "998346",
    Quantity: "1",
    "GST Rate (%)": "18",
    "Taxable Value (Rs)": "31600",
    "IGST (Rs)": "5688",
    "CGST (Rs)": "0",
    "SGST (Rs)": "0",
    "Total Amount (Rs)": "37288",
    ...over,
  });

  it("is reported as a credit note, not as another sale to the business", () => {
    const [note] = OfflineInvoicesAdapter.adapt([row({})], context).transactions;

    expect(note!.invoiceType).toBe("CDNR");
    expect(note!.transactionType).toBe("Return");
    expect(note!.taxableValue).toBe(31600);
  });

  it("carries a negative note unsigned, the direction being in its category", () => {
    const [note] = OfflineInvoicesAdapter.adapt(
      [row({ "Document Type": "", "Taxable Value (Rs)": "-31600", "IGST (Rs)": "-5688" })],
      context
    ).transactions;

    expect(note!.invoiceType).toBe("CDNR");
    expect(note!.taxableValue).toBe(31600);
    expect(note!.igstAmount).toBe(5688);
  });

  it("leaves an IGST note to an unregistered buyer without a state rather than guess one", () => {
    const [note] = OfflineInvoicesAdapter.adapt(
      [row({ "Buyer GSTIN": "", "Taxable Value (Rs)": "3500", "IGST (Rs)": "630" })],
      context
    ).transactions;

    expect(note!.invoiceType).toBe("CDNCS");
    expect(note!.placeOfSupply).toBe("");
  });
});

describe("recognising a credit note in a PDF", () => {
  it("does not take an invoice's terms for its title", () => {
    const invoice = extractInvoiceFromText({
      text: [
        "Invoice #: KICG48K2CG3Y0726",
        "Tax Invoice",
        "Sold By: Seller",
        "GSTIN: 29AAACK1234A1Z5",
        "2. All the Invoice, Debit & Credit note values are inclusive of GST.",
      ].join("\n"),
      fileName: "invoice.pdf",
      fileSizeBytes: 1,
      pageCount: 1,
    });

    expect(invoice.documentType).toBe("Invoice");
  });

  it("knows one that is titled or numbered as a credit note", () => {
    for (const text of ["Credit Note\nSeller", "Credit Note No: ly5kw27C1\nSeller"]) {
      const invoice = extractInvoiceFromText({
        text,
        fileName: "cn.pdf",
        fileSizeBytes: 1,
        pageCount: 1,
      });
      expect(invoice.documentType).toBe("Credit Note");
    }
  });
});
