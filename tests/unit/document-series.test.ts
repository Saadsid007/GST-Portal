import { describe, it, expect } from "vitest";
import {
  buildDocumentSeries,
  documentSeriesStem,
  isRealSeries,
  countUnseriesedDocuments,
  documentTypeSerial,
} from "@/features/convert/domain/document-series";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

function row(invoiceNumber: string, over: Partial<NormalizedInvoiceRow> = {}) {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    transactionType: "Sales",
    invoiceNumber,
    invoiceDate: "2026-08-13",
    invoiceType: "B2CS",
    buyerName: "Customer",
    buyerGstin: "",
    placeOfSupply: "29",
    hsnCode: "441900",
    quantity: 1,
    taxableValue: 100,
    igstRate: 5,
    cgstRate: 0,
    sgstRate: 0,
    cessRate: 0,
    igstAmount: 5,
    cgstAmount: 0,
    sgstAmount: 0,
    cessAmount: 0,
    totalValue: 105,
    errors: [],
    ...over,
  } as NormalizedInvoiceRow;
}

describe("separating a series from an order reference", () => {
  it("takes the stem before the trailing number", () => {
    expect(documentSeriesStem("IN-1024")).toBe("IN-");
    expect(documentSeriesStem("2026-2027/57")).toBe("2026-2027/");
  });

  it("accepts a short, punctuated stem", () => {
    expect(isRealSeries("IN-", 1)).toBe(true);
    expect(isRealSeries("2026-2027/", 4)).toBe(true);
  });

  it("rejects a long unbroken run of digits", () => {
    // A Meesho order reference: fourteen digits, unique to one order.
    expect(isRealSeries("00038883474816_", 1)).toBe(false);
  });

  it("rejects a letterless stem seen only once", () => {
    // One order split across two shipments shares a stem, so counting
    // documents alone would let it pass as a series.
    expect(isRealSeries("#", 1)).toBe(false);
    expect(isRealSeries("#", 2)).toBe(true);
  });
});

describe("Table 13", () => {
  it("reports the seller's own series with its range", () => {
    const series = buildDocumentSeries([row("IN-113"), row("IN-118"), row("IN-123")]);

    expect(series).toEqual([
      {
        documentType: "Invoices for outward supply",
        from: "IN-113",
        to: "IN-123",
        totalNumber: 3,
        cancelled: 0,
      },
    ]);
  });

  it("leaves marketplace order references out entirely", () => {
    // They used to be folded into one row and reported. The range that
    // produced — smallest to largest of a sorted list of order numbers —
    // describes no book, and every filed return in the corpus omits it.
    const series = buildDocumentSeries([
      row("00038883474816_1"),
      row("99947360054592_1"),
      row("31954290442588_2"),
    ]);

    expect(series).toEqual([]);
  });

  it("keeps the real series when both are present", () => {
    const series = buildDocumentSeries([
      row("00038883474816_1"),
      row("IN-113"),
      row("IN-123"),
      row("99947360054592_1"),
    ]);

    expect(series).toHaveLength(1);
    expect(series[0]!.from).toBe("IN-113");
    expect(series[0]!.totalNumber).toBe(2);
  });

  it("keeps each series apart rather than spanning both", () => {
    // "2026-2027/57 to IN-1026" describes no series that exists.
    const series = buildDocumentSeries([
      row("IN-707"),
      row("IN-1026"),
      row("2026-2027/57"),
      row("2026-2027/72"),
    ]);

    expect(series.map((s) => `${s.from}→${s.to}`)).toEqual([
      "2026-2027/57→2026-2027/72",
      "IN-707→IN-1026",
    ]);
  });

  it("lists invoices before credit notes", () => {
    const series = buildDocumentSeries([
      row("CN-23", { invoiceType: "CDNCS", transactionType: "Return" }),
      row("CN-25", { invoiceType: "CDNCS", transactionType: "Return" }),
      row("IN-113"),
      row("IN-123"),
    ]);

    expect(series.map((s) => s.documentType)).toEqual([
      "Invoices for outward supply",
      "Credit Note",
    ]);
  });

  it("does not let a credit note's stem absorb the word 'Note'", () => {
    // The document type and the stem were once joined into one key and split
    // on the first space, which put "Note" into the series stem.
    const series = buildDocumentSeries([
      row("CN-23", { invoiceType: "CDNCS", transactionType: "Return" }),
      row("CN-24", { invoiceType: "CDNCS", transactionType: "Return" }),
    ]);

    expect(series[0]!.from).toBe("CN-23");
    expect(series[0]!.to).toBe("CN-24");
  });

  it("counts each document once however many lines it has", () => {
    const series = buildDocumentSeries([row("IN-113"), row("IN-113"), row("IN-114")]);

    expect(series[0]!.totalNumber).toBe(2);
  });

  it("ignores rows with no document number at all", () => {
    expect(buildDocumentSeries([row(""), row("  ")])).toEqual([]);
  });
});

describe("telling the user what was left out", () => {
  it("counts the documents that carry no series of their own", () => {
    // A seller seeing two invoices listed, having sold hundreds of items,
    // needs to be told why.
    const rows = [row("IN-113"), row("IN-123"), row("00038883474816_1"), row("99947360054592_1")];

    expect(countUnseriesedDocuments(rows)).toBe(2);
  });

  it("counts nothing when every document belongs to a series", () => {
    expect(countUnseriesedDocuments([row("IN-113"), row("IN-123")])).toBe(0);
  });
});

describe("the statutory Nature of Document serial", () => {
  it("files a credit note under 5, not 4", () => {
    // 4 is the Debit Note in the return format's fixed list. The JSON
    // generator emitted doc_num 4 for the credit note series, which declared
    // the seller's credit notes to the portal as debit notes.
    expect(documentTypeSerial("Credit Note")).toBe(5);
    expect(documentTypeSerial("Invoices for outward supply")).toBe(1);
  });
});
