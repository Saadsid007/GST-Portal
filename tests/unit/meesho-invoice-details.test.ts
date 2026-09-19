import { describe, it, expect } from "vitest";
import {
  isInvoiceDetailsSheet,
  parseInvoiceDetails,
  applyInvoiceDetails,
} from "@/features/convert/engine/enrichment/meesho-invoice-details";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

const DETAILS_HEADERS = [
  "Type",
  "Order Date",
  "Suborder No.",
  "Product Description",
  "HSN",
  "Invoice No.",
];

function detailsRow(suborder: string, invoice: string, over: Record<string, string> = {}) {
  return {
    Type: "INVOICE",
    "Order Date": "2026-07-25 19:22:04",
    "Suborder No.": suborder,
    "Product Description": "Wireless Bluetooth P9 Headphones",
    HSN: "8518",
    "Invoice No.": invoice,
    ...over,
  };
}

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    sourcePlatformId: "meesho",
    sourcePlatformName: "Meesho",
    transactionType: "Sales",
    invoiceNumber: "312587738666181376_1",
    invoiceDate: "2026-07-25",
    invoiceType: "B2CS",
    buyerName: "Customer",
    buyerGstin: "",
    placeOfSupply: "06",
    hsnCode: "",
    itemDescription: "Meesho Order 312587738666181376_1",
    uqc: "PCS",
    quantity: 1,
    taxableValue: 1000,
    igstRate: 5,
    cgstRate: 0,
    sgstRate: 0,
    cessRate: 0,
    igstAmount: 50,
    cgstAmount: 0,
    sgstAmount: 0,
    cessAmount: 0,
    totalValue: 1050,
    errors: [],
    ...over,
  } as NormalizedInvoiceRow;
}

describe("recognising the invoice-number index", () => {
  it("accepts the sheet Meesho ships with the invoice PDFs", () => {
    expect(isInvoiceDetailsSheet(DETAILS_HEADERS)).toBe(true);
  });

  it("rejects a register that merely has invoice numbers", () => {
    // Without a suborder column there is nothing to map from, and treating a
    // value-bearing register as an index would drop its amounts.
    expect(isInvoiceDetailsSheet(["Invoice Number", "Customer State", "Taxable Amount"])).toBe(
      false
    );
  });

  it("rejects the TCS export itself", () => {
    expect(isInvoiceDetailsSheet(["identifier", "sub_order_num", "hsn_code", "gst_rate"])).toBe(
      false
    );
  });
});

describe("replacing order references with the invoice actually issued", () => {
  const index = parseInvoiceDetails([
    detailsRow("312587738666181376_1", "ly5kw2712"),
    detailsRow("312579929819987136_1", "ly5kw2715"),
  ]);

  it("reads the mapping", () => {
    expect(index.size).toBe(2);
    expect(index.get("312587738666181376_1")?.invoiceNumber).toBe("ly5kw2712");
  });

  it("puts the real invoice number on the row", () => {
    // Table 13 counts documents per series. Left as order ids, every supply is
    // its own series of one, and the seller reports hundreds of series where
    // they issued one.
    const [out] = applyInvoiceDetails([row({})], index);

    expect(out!.invoiceNumber).toBe("ly5kw2712");
  });

  it("matches even after the 16-character GSTR-1 truncation", () => {
    // The transformation engine keeps only the last 16 characters, so the row
    // no longer carries the full suborder by the time the index is applied.
    const truncated = row({ invoiceNumber: "587738666181376_1" });

    expect(applyInvoiceDetails([truncated], index)[0]!.invoiceNumber).toBe("ly5kw2712");
  });

  it("supplies the commodity HSN the TCS export omits", () => {
    expect(applyInvoiceDetails([row({ hsnCode: "" })], index)[0]!.hsnCode).toBe("8518");
  });

  it("keeps an HSN the export did provide", () => {
    expect(applyInvoiceDetails([row({ hsnCode: "732690" })], index)[0]!.hsnCode).toBe("732690");
  });

  it("replaces the invented description with the product's own", () => {
    // "Meesho Order 3125877…" describes no commodity, and it is what lands in
    // the Table 12 description column.
    const [out] = applyInvoiceDetails([row({})], index);

    expect(out!.itemDescription).toBe("Wireless Bluetooth P9 Headphones");
  });

  it("leaves an unmatched row alone rather than guessing", () => {
    // Wrong but visible beats silently paired with someone else's invoice.
    const stranger = row({ invoiceNumber: "999999999999999_9" });

    expect(applyInvoiceDetails([stranger], index)[0]!.invoiceNumber).toBe("999999999999999_9");
  });

  it("does not touch other platforms", () => {
    const amazon = row({ sourcePlatformId: "amazon", invoiceNumber: "312587738666181376_1" });

    expect(applyInvoiceDetails([amazon], index)[0]!.invoiceNumber).toBe("312587738666181376_1");
  });

  it("is a no-op when no index was uploaded", () => {
    const rows = [row({})];

    expect(applyInvoiceDetails(rows, new Map())).toBe(rows);
  });
});
