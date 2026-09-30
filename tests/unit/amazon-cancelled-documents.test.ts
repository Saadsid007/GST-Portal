import { describe, it, expect } from "vitest";
import { AmazonAdapter } from "@/features/convert/engine/adapters/amazon.adapter";
import { buildDocumentSeries } from "@/features/convert/domain/document-series";
import { validateInvoices } from "@/features/convert/domain/validator";
import { generateGstr1Json } from "@/features/convert/domain/gstr1-json.generator";
import type { ConversionSummary } from "@/features/convert/types/convert.types";

const GSTIN = "09AGCPW4984F2ZT";
const context = {
  marketplace: "AMAZON",
  sourceId: "a",
  fileId: "mtr.csv",
  fileName: "MTR_B2C-AUGUST-2026.csv",
  sourceRow: 0,
  reportType: "mtr",
  supplierGstin: GSTIN,
};

function mtr(over: Record<string, string>): Record<string, string> {
  return {
    "Seller Gstin": GSTIN,
    "Invoice Number": "IN-34",
    "Invoice Date": "2026-08-03 09:47:28",
    "Transaction Type": "Shipment",
    "Order Id": "408-1890133-1006736",
    Quantity: "1",
    "Hsn/sac": "4421",
    "Ship To State": "ODISHA",
    "Invoice Amount": "3349",
    "Tax Exclusive Gross": "3189.52",
    "Total Tax Amount": "159.48",
    "Igst Rate": "0.05",
    "Igst Tax": "159.48",
    ...over,
  };
}

const zero = {
  "Invoice Amount": "0",
  "Tax Exclusive Gross": "0",
  "Total Tax Amount": "0",
  "Igst Rate": "0",
  "Igst Tax": "0",
};

describe("an Amazon invoice numbered and then cancelled", () => {
  const rows = [
    mtr({}),
    mtr({ "Invoice Number": "IN-35", "Order Id": "403-0842017-1123502" }),
    // Numbered, then cancelled — nothing supplied.
    mtr({ "Invoice Number": "IN-38", "Transaction Type": "Cancel", ...zero }),
    // "Cancel" against a credit note that was then issued anyway.
    mtr({ "Invoice Number": "CN-15", "Transaction Type": "Cancel", ...zero }),
    mtr({
      "Invoice Number": "IN-35",
      "Transaction Type": "Refund",
      "Credit Note No": "CN-15",
      "Invoice Amount": "-3349",
      "Tax Exclusive Gross": "-3189.52",
      "Igst Tax": "-159.48",
    }),
    // A cancelled order Amazon never numbered.
    mtr({ "Invoice Number": "", "Transaction Type": "Cancel", ...zero }),
  ];

  const { transactions } = AmazonAdapter.adapt(rows, context);

  it("keeps the number for Table 13, and only a number that was really used", () => {
    expect(transactions.filter((t) => t.documentOnly).map((t) => t.invoiceNumber)).toEqual([
      "IN-38",
    ]);
  });

  it("counts it as issued and cancelled", () => {
    // Dropped as before, Table 13 read IN-34 to IN-35 with nothing cancelled.
    const invoices = buildDocumentSeries(transactions).find(
      (s) => s.documentType === "Invoices for outward supply"
    )!;

    expect(invoices.to).toBe("IN-38");
    expect(invoices.totalNumber).toBe(3);
    expect(invoices.cancelled).toBe(1);
  });

  it("adds nothing to any table and raises no error", () => {
    const { rows: validated, errorCount } = validateInvoices(transactions, GSTIN);
    const json = JSON.parse(generateGstr1Json(validated, GSTIN, "082026", {} as ConversionSummary));
    const b2cs = (json.b2cs as { txval: number }[]).reduce((s, b) => s + b.txval, 0);

    expect(errorCount).toBe(0);
    expect(b2cs).toBeCloseTo(3189.52 + 3189.52 - 3189.52, 2);
    expect(json.doc_issue.doc_det[0].docs[0].cancel).toBe(1);
  });
});
