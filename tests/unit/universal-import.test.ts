import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  readWorkbook,
  solveTable,
  toCanonicalRows,
} from "@/features/convert/engine/universal/universal-import.engine";
import { recoverRows } from "@/features/convert/engine/universal/recovery";
import {
  classifyDuplicates,
  redundantRowIndexes,
} from "@/features/convert/engine/universal/duplicates";
import { understandWorkbook } from "@/features/convert/engine/universal/understanding";
import { reconstructWorkbook } from "@/features/convert/engine/universal/table-reconstructor";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";

/**
 * These fixtures are deliberately not modelled on any marketplace's real export.
 * The engine is supposed to solve files it has never seen, so testing it against
 * shapes it was written for would prove nothing.
 */

/** Builds an .xlsx buffer from a raw grid, exactly as a messy export would ship. */
function workbookFrom(grid: unknown[][], sheetName = "Sheet1"): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function tableFrom(grid: unknown[][], sheetName = "Sheet1"): ReconstructedTable {
  const tables = readWorkbook(workbookFrom(grid, sheetName));
  const first = tables[0];
  if (!first) throw new Error("No table was reconstructed");
  return first;
}

function baseRow(overrides: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: "r1",
    rowIndex: 0,
    invoiceNumber: "INV-1",
    invoiceDate: "2026-05-04",
    invoiceType: "B2CS",
    buyerName: "Customer",
    buyerGstin: "",
    placeOfSupply: "29",
    hsnCode: "610910",
    quantity: 1,
    taxableValue: 1000,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    cessRate: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    cessAmount: 0,
    totalValue: 0,
    errors: [],
    ...overrides,
  };
}

describe("Layer 1 — universal file reader", () => {
  it("finds the header under a title block instead of assuming row 0", () => {
    const table = tableFrom([
      ["ACME RETAIL PRIVATE LIMITED"],
      ["Sales register for the period 01-05-2026 to 31-05-2026"],
      [],
      ["Invoice No", "Invoice Date", "Ship To State", "Taxable Amount", "Tax"],
      ["INV-001", "04-05-2026", "Karnataka", "1000", "180"],
      ["INV-002", "05-05-2026", "Maharashtra", "2000", "360"],
    ]);

    expect(table.headerRowIndex).toBe(3);
    expect(table.headers).toContain("Invoice No");
    expect(table.rows).toHaveLength(2);
    // The two title lines and the blank are recorded, not silently swallowed.
    expect(table.discarded.filter((d) => d.kind === "PREAMBLE")).toHaveLength(2);
  });

  it("drops totals bands, repeated headers and trailing notes", () => {
    const header = ["Invoice No", "Invoice Date", "State", "Taxable Value", "Tax Amount"];
    const table = tableFrom([
      header,
      ["INV-001", "04-05-2026", "Karnataka", "1000", "180"],
      [],
      header,
      ["INV-002", "05-05-2026", "Kerala", "2000", "360"],
      ["Grand Total", "", "", "3000", "540"],
      ["* Figures are provisional"],
    ]);

    expect(table.rows).toHaveLength(2);
    expect(table.discarded.map((d) => d.kind)).toEqual(
      expect.arrayContaining(["BLANK", "REPEATED_HEADER", "TOTALS", "FOOTER"])
    );
  });

  it("merges a header split across two rows", () => {
    const table = tableFrom([
      ["Document", "", "Tax", "", "Value"],
      ["Number", "Date", "IGST", "Cess", "Taxable"],
      ["INV-1", "04-05-2026", "180", "0", "1000"],
      ["INV-2", "05-05-2026", "360", "0", "2000"],
    ]);

    expect(table.headerRowSpan).toBe(2);
    expect(table.headers[0]).toBe("Document Number");
    expect(table.headers).toContain("Tax IGST");
    expect(table.rows).toHaveLength(2);
  });

  it("picks the transaction sheet over a longer instructions sheet", () => {
    const workbook = XLSX.utils.book_new();
    const notes = Array.from({ length: 40 }, (_, i) => [`Step ${i + 1}: read this carefully`]);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(notes), "Read Me");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Invoice No", "Invoice Date", "Place of Supply", "Taxable Value", "IGST Amount"],
        ["INV-1", "04-05-2026", "29", "1000", "180"],
        ["INV-2", "05-05-2026", "27", "2000", "360"],
      ]),
      "Data"
    );

    const tables = reconstructWorkbook(workbook);
    expect(tables[0]?.sheetName).toBe("Data");
  });
});

describe("Delimited text is solved the same way as a workbook", () => {
  /** The reader is format-agnostic: the same layers run over CSV and TSV. */
  function delimited(delimiter: string): string {
    return [
      "Bharat Traders — Outward Register",
      "",
      [
        "Doc Ref",
        "Doc Dt",
        "Party GST",
        "Delivery State",
        "Commodity",
        "Assessable Value",
        "Tax Charged",
      ].join(delimiter),
      ["BILL/1", "04-07-2026", "27AAACR5055K1Z5", "Maharashtra", "852990", "5000", "900"].join(
        delimiter
      ),
      ["BILL/2", "05-07-2026", "", "Kerala", "852990", "6000", "1080"].join(delimiter),
      ["BILL/3", "06-07-2026", "", "Goa", "852990", "7000", "1260"].join(delimiter),
    ].join("\n");
  }

  it.each([
    ["CSV", ","],
    ["TSV", "\t"],
  ])("reads %s, skips the preamble and maps by evidence", (_label, delimiter) => {
    const tables = readWorkbook(Buffer.from(delimited(delimiter), "utf8"));
    const table = tables[0];
    expect(table).toBeDefined();
    if (!table) return;

    expect(table.rows).toHaveLength(3);
    const { mapping } = solveTable(table, { fileName: `register.${_label.toLowerCase()}` });
    expect(mapping.taxableValue).toBe("Assessable Value");
    expect(mapping.placeOfSupply).toBe("Delivery State");
    expect(mapping.invoiceDate).toBe("Doc Dt");
  });
});

describe("Layer 3 — field discovery from values, not headers", () => {
  it("maps a file whose headers carry no meaning at all", () => {
    const rows = Array.from({ length: 12 }, (_, i) => [
      `A-${1000 + i}`,
      `0${(i % 9) + 1}-05-2026`,
      i % 2 === 0 ? "29AAACR5055K1Z5" : "",
      "Karnataka",
      "610910",
      String(1000 + i * 10),
      "18",
    ]);

    const table = tableFrom([["c1", "c2", "c3", "c4", "c5", "c6", "c7"], ...rows]);
    const { mapping } = solveTable(table, { fileName: "unknown.xlsx" });

    expect(mapping.invoiceNumber).toBe("c1");
    expect(mapping.invoiceDate).toBe("c2");
    expect(mapping.buyerGstin).toBe("c3");
    expect(mapping.placeOfSupply).toBe("c4");
    expect(mapping.hsnCode).toBe("c5");
    expect(mapping.taxableValue).toBe("c6");
  });

  it("refuses a header whose values contradict it", () => {
    // The column called "Invoice Date" holds GSTINs; the real dates are elsewhere.
    const rows = Array.from({ length: 10 }, (_, i) => [
      `INV-${i}`,
      "29AAACR5055K1Z5",
      `1${i}-05-2026`,
      "Karnataka",
      String(1000 + i),
    ]);

    const table = tableFrom([
      ["Invoice No", "Invoice Date", "Posting Day", "State", "Taxable Value"],
      ...rows,
    ]);
    const { mapping } = solveTable(table, { fileName: "mislabelled.xlsx" });

    expect(mapping.invoiceDate).toBe("Posting Day");
    expect(mapping.buyerGstin).toBe("Invoice Date");
  });

  it("binds each column to at most one field", () => {
    const table = tableFrom([
      ["Order No", "Order Date", "State", "Taxable Value", "Total Value"],
      ["ORD-1", "04-05-2026", "Karnataka", "1000", "1180"],
      ["ORD-2", "05-05-2026", "Kerala", "2000", "2360"],
      ["ORD-3", "06-05-2026", "Goa", "3000", "3540"],
    ]);
    const { mapping } = solveTable(table, { fileName: "orders.xlsx" });

    const columns = Object.values(mapping).filter(Boolean);
    expect(new Set(columns).size).toBe(columns.length);
  });

  it("does not read a date column as an HSN code", () => {
    const table = tableFrom([
      ["Ref", "Dispatch", "State", "Amount"],
      ["INV-1", "05-12-2026", "Karnataka", "1000"],
      ["INV-2", "06-12-2026", "Kerala", "2000"],
      ["INV-3", "07-12-2026", "Goa", "3000"],
    ]);
    const { mapping } = solveTable(table, { fileName: "dates.xlsx" });

    expect(mapping.hsnCode).toBeUndefined();
    expect(mapping.invoiceDate).toBe("Dispatch");
  });

  it("keeps the runner-up available instead of discarding it", () => {
    const table = tableFrom([
      ["Invoice No", "Order No", "Order Date", "State", "Taxable Value"],
      ["INV-1", "ORD-1", "04-05-2026", "Karnataka", "1000"],
      ["INV-2", "ORD-2", "05-05-2026", "Kerala", "2000"],
      ["INV-3", "ORD-3", "06-05-2026", "Goa", "3000"],
    ]);
    const { report } = solveTable(table, { fileName: "two-refs.xlsx" });

    const invoice = report.resolutions.find((r) => r.field === "invoiceNumber");
    expect(invoice?.column).toBe("Invoice No");
    expect(invoice?.alternatives.map((a) => a.column)).toContain("Order No");
  });
});

describe("Layer 2 — workbook understanding", () => {
  it("reads a file with both sales and reversals as mixed", () => {
    const table = tableFrom([
      ["Invoice No", "Type", "Date", "State", "Taxable Value"],
      ["INV-1", "Sale", "04-05-2026", "Karnataka", "1000"],
      ["INV-2", "Sale", "05-05-2026", "Kerala", "2000"],
      ["INV-3", "Return", "06-05-2026", "Goa", "-500"],
    ]);

    const understanding = understandWorkbook(table);
    expect(understanding.documentType).toBe("MIXED");
    expect(understanding.period).toBe("052026");
  });

  it("reads a clean sales register as sales", () => {
    const table = tableFrom([
      ["Invoice No", "Date", "State", "Taxable Value"],
      ["INV-1", "04-06-2026", "Karnataka", "1000"],
      ["INV-2", "05-06-2026", "Kerala", "2000"],
    ]);

    const understanding = understandWorkbook(table);
    expect(understanding.documentType).toBe("SALES");
    expect(understanding.period).toBe("062026");
    expect(understanding.supplyMix).toBe("B2C");
  });

  it("recognises a settlement report and does not treat it as sales", () => {
    const table = tableFrom([
      ["Order No", "Settlement Date", "Commission Fee", "Payout Amount", "UTR"],
      ["ORD-1", "04-05-2026", "50", "950", "UTR001"],
      ["ORD-2", "05-05-2026", "80", "1920", "UTR002"],
    ]);

    expect(understandWorkbook(table).documentType).toBe("SETTLEMENT");
  });
});

describe("Layer 6 — recovery reasons about values instead of guessing", () => {
  it("derives the rate from tax and taxable value, and explains the derivation", () => {
    const rows = [baseRow({ taxableValue: 25000, igstAmount: 4500, placeOfSupply: "29" })];
    const { rows: recovered, recoveries } = recoverRows(
      rows,
      understandWorkbook(
        tableFrom([
          ["a", "b"],
          ["1", "2"],
        ])
      ),
      "27"
    );

    expect(recovered[0]?.igstRate).toBe(18);
    const record = recoveries.find((r) => r.field === "gstRate");
    expect(record?.value).toBe("18%");
    expect(record?.confidence).toBeGreaterThan(95);
    expect(record?.path.join(" ")).toContain("18");
  });

  it("splits an intra-state supply into equal CGST and SGST halves", () => {
    const rows = [baseRow({ taxableValue: 1000, igstAmount: 180, placeOfSupply: "29" })];
    const { rows: recovered } = recoverRows(
      rows,
      understandWorkbook(
        tableFrom([
          ["a", "b"],
          ["1", "2"],
        ])
      ),
      "29"
    );

    expect(recovered[0]?.cgstRate).toBe(9);
    expect(recovered[0]?.sgstRate).toBe(9);
    expect(recovered[0]?.igstAmount).toBe(0);
    expect(recovered[0]?.cgstAmount).toBe(90);
  });

  it("refuses to invent a rate that lands on no notified slab", () => {
    // 7.3% is not a GST rate. The two columns disagree, and freezing that
    // disagreement into a rate would hide a real data problem.
    const rows = [baseRow({ taxableValue: 1000, igstAmount: 73, totalValue: 0 })];
    const { rows: recovered, recoveries } = recoverRows(
      rows,
      understandWorkbook(
        tableFrom([
          ["a", "b"],
          ["1", "2"],
        ])
      ),
      "27"
    );

    expect(recovered[0]?.igstRate).toBe(0);
    expect(recoveries.filter((r) => r.field === "gstRate")).toHaveLength(0);
  });

  it("borrows a slab from other rows with the same HSN, but only when they agree", () => {
    const understanding = understandWorkbook(
      tableFrom([
        ["a", "b"],
        ["1", "2"],
      ])
    );

    const agreeing = recoverRows(
      [
        baseRow({ id: "a", hsnCode: "610910", taxableValue: 1000, igstAmount: 50, igstRate: 5 }),
        baseRow({ id: "b", hsnCode: "610910", taxableValue: 2000 }),
      ],
      understanding,
      "27"
    );
    expect(agreeing.rows[1]?.igstRate).toBe(5);

    const disagreeing = recoverRows(
      [
        baseRow({ id: "a", hsnCode: "610910", taxableValue: 1000, igstAmount: 50, igstRate: 5 }),
        baseRow({ id: "b", hsnCode: "610910", taxableValue: 1000, igstAmount: 120, igstRate: 12 }),
        baseRow({ id: "c", hsnCode: "610910", taxableValue: 2000 }),
      ],
      understanding,
      "27"
    );
    expect(disagreeing.rows[2]?.igstRate).toBe(0);
  });

  it("recovers the place of supply from the buyer's GSTIN", () => {
    const rows = [baseRow({ placeOfSupply: "", buyerGstin: "29AAACR5055K1Z5" })];
    const { rows: recovered, recoveries } = recoverRows(
      rows,
      understandWorkbook(
        tableFrom([
          ["a", "b"],
          ["1", "2"],
        ])
      ),
      "27"
    );

    expect(recovered[0]?.placeOfSupply).toBe("29");
    expect(recoveries.find((r) => r.field === "placeOfSupply")?.confidence).toBe(100);
  });

  it("backs the taxable value out of a gross total", () => {
    const rows = [baseRow({ taxableValue: 0, totalValue: 1180, igstRate: 18 })];
    const { rows: recovered } = recoverRows(
      rows,
      understandWorkbook(
        tableFrom([
          ["a", "b"],
          ["1", "2"],
        ])
      ),
      "27"
    );

    expect(recovered[0]?.taxableValue).toBe(1000);
    expect(recovered[0]?.igstAmount).toBe(180);
  });
});

describe("Duplicate intelligence", () => {
  it("treats the lines of one invoice as line items, not duplicates", () => {
    const rows = [
      baseRow({ id: "a", invoiceNumber: "INV-1", hsnCode: "610910", taxableValue: 1000 }),
      baseRow({ id: "b", invoiceNumber: "INV-1", hsnCode: "640399", taxableValue: 2000 }),
    ];

    const verdicts = classifyDuplicates(rows);
    expect(verdicts.some((v) => v.classification === "LINE_ITEMS")).toBe(true);
    expect(redundantRowIndexes(verdicts).size).toBe(0);
  });

  it("identifies genuinely repeated records", () => {
    const rows = [
      baseRow({ id: "a", invoiceNumber: "INV-1", taxableValue: 1000 }),
      baseRow({ id: "b", invoiceNumber: "INV-1", taxableValue: 1000 }),
    ];

    const verdicts = classifyDuplicates(rows);
    expect(verdicts.some((v) => v.classification === "EXACT_DUPLICATE")).toBe(true);
    expect([...redundantRowIndexes(verdicts)]).toEqual([1]);
  });

  it("never collapses a sale against its own reversal", () => {
    const rows = [
      baseRow({ id: "a", invoiceNumber: "INV-1", taxableValue: 1000, transactionType: "Sales" }),
      baseRow({ id: "b", invoiceNumber: "INV-1", taxableValue: -1000, transactionType: "Return" }),
    ];

    const verdicts = classifyDuplicates(rows);
    expect(verdicts.some((v) => v.classification === "SALE_AND_RETURN")).toBe(true);
    expect(redundantRowIndexes(verdicts).size).toBe(0);
  });
});

describe("End to end on an unseen format", () => {
  it("solves a workbook it has no parser for and explains what it did", () => {
    const rows = Array.from({ length: 15 }, (_, i) => [
      `BILL/26-27/${100 + i}`,
      `${(i % 28) + 1}-07-2026`,
      i % 3 === 0 ? "27AAACR5055K1Z5" : "",
      i % 3 === 0 ? "Wholesale Traders LLP" : "Retail customer",
      "Maharashtra",
      "852990",
      "2",
      String(5000 + i * 100),
      String(Math.round((5000 + i * 100) * 0.18)),
    ]);

    const table = tableFrom(
      [
        ["Bharat Traders — Outward Supplies"],
        [],
        [
          "Document Ref",
          "Doc Dt",
          "Party GST No",
          "Party",
          "Delivery State",
          "Commodity Code",
          "Units",
          "Assessable Value",
          "Tax Charged",
        ],
        ...rows,
        ["Total", "", "", "", "", "", "", "82500", "14850"],
      ],
      "Outward"
    );

    const { mapping, report } = solveTable(table, { fileName: "bharat-traders.xlsx" });

    // Nothing in the engine has ever seen these column names.
    expect(mapping.invoiceNumber).toBe("Document Ref");
    expect(mapping.invoiceDate).toBe("Doc Dt");
    expect(mapping.buyerGstin).toBe("Party GST No");
    expect(mapping.placeOfSupply).toBe("Delivery State");
    expect(mapping.hsnCode).toBe("Commodity Code");
    expect(mapping.taxableValue).toBe("Assessable Value");

    expect(report.understanding.documentType).toBe("SALES");
    expect(report.understanding.supplyMix).toBe("MIXED");
    expect(report.understanding.period).toBe("072026");
    expect(report.scores.overall).toBeGreaterThan(60);

    // Every bound field can say why it was bound.
    for (const resolution of report.resolutions.filter((r) => r.column)) {
      expect(resolution.evidence.length).toBeGreaterThan(0);
    }

    const canonical = toCanonicalRows(table, mapping);
    expect(canonical).toHaveLength(15);
    expect(canonical[0]?.invoiceNumber).toBe("BILL/26-27/100");
  });
});
