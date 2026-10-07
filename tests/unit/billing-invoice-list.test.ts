import { describe, it, expect } from "vitest";
import { runConversionPipeline } from "@/features/convert/engine/pipeline/conversion.pipeline";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";

const GSTIN = "07AANCM6581E1Z5";

// Zoho Books' "Invoice Details" export: the books' columns beside the tax
// ones, and no taxable value, rate or place of supply.
const HEADERS = [
  "Status",
  "Invoice Date",
  "Due Date",
  "Invoice#",
  "Customer Name",
  "Total",
  "Balance",
  "GSTIN",
  "GST Treatment",
  "SGST Amount",
  "CGST Amount",
  "Exchange Rate",
  "IGST Amount",
];

function row(values: (string | number)[]): Record<string, string> {
  return Object.fromEntries(HEADERS.map((h, i) => [h, String(values[i] ?? "")]));
}

const ROWS = [
  [
    "Draft",
    "01/09/2026",
    "01/09/2026",
    "177",
    "Spectrum Smart Switchgears",
    "₹17,110.00",
    "₹17,110.00",
    "09ABFCS6405E1ZE",
    "Registered Business - Regular",
    "₹0.00",
    "₹0.00",
    "1",
    "₹2,610.00",
  ],
  [
    "Draft",
    "01/09/2026",
    "01/09/2026",
    "178",
    "Command Hospital",
    "₹39,766.00",
    "₹39,766.00",
    "",
    "Unregistered Business",
    "₹3,033.00",
    "₹3,033.00",
    "1",
    "₹0.00",
  ],
  [
    "Draft",
    "04/09/2026",
    "04/09/2026",
    "181",
    "Delhi Analytical",
    "₹17,110.00",
    "₹17,110.00",
    "07AANFD5928P1ZO",
    "Registered Business - Composition",
    "₹1,305.00",
    "₹1,305.00",
    "1",
    "₹0.00",
  ],
  [
    "Draft",
    "10/09/2026",
    "10/09/2026",
    "187",
    "IVD Yoda Foundation",
    "₹10,502.00",
    "₹10,502.00",
    "",
    "Unregistered Business",
    "₹0.00",
    "₹0.00",
    "1",
    "₹1,602.00",
  ],
  [
    "Draft",
    "11/09/2026",
    "11/09/2026",
    "188",
    "Orion Conmerx",
    "₹15,812.00",
    "₹15,812.00",
    "06AAACO1432D1Z4",
    "Registered Business - Regular",
    "₹0.00",
    "₹0.00",
    "1",
    "₹2,412.00",
  ],
  [
    "Paid",
    "25/09/2026",
    "25/09/2026",
    "204",
    "Captive Power Engineering",
    "₹21,476.00",
    "₹0.00",
    "07AHTPG3008Q1ZV",
    "Registered Business - Regular",
    "₹1,638.00",
    "₹1,638.00",
    "1",
    "₹0.00",
  ],
  [
    "Draft",
    "18/09/2026",
    "18/09/2026",
    "197",
    "Punjab Tech Calibration",
    "₹22,184.00",
    "₹22,184.00",
    "03AGEPB7056M1ZH",
    "Registered Business - Regular",
    "₹1,692.00",
    "₹1,692.00",
    "1",
    "₹0.00",
  ],
].map(row);

const table: ReconstructedTable = {
  sheetName: "Invoice Details",
  headers: HEADERS,
  rows: ROWS,
  headerRowIndex: 1,
  headerRowSpan: 1,
  discarded: [],
  score: 90,
};

async function convert() {
  const result = await runConversionPipeline({
    rawTables: [{ fileId: "zoho.xlsx", fileName: "zoho.xlsx", table }],
    files: [{ fileName: "zoho.xlsx", platformId: "custom", fileTypeId: "custom" }],
    gstinNumber: GSTIN,
    returnPeriod: "092026",
  });
  if (!result) throw new Error("no result");
  const byNumber = new Map(result.rows.map((r) => [r.invoiceNumber, r]));
  return { result, invoice: (n: string) => byNumber.get(n)! };
}

describe("an invoice list exported from billing software", () => {
  it("takes the taxable value as the total less the tax, never the unpaid balance", async () => {
    const { invoice } = await convert();
    expect(invoice("177").taxableValue).toBe(14500);
    expect(invoice("204").taxableValue).toBe(18200);
    expect(invoice("177").igstRate).toBe(18);
    expect(invoice("181").cgstRate + invoice("181").sgstRate).toBe(18);
  });

  it("does not read the exchange rate as a GST rate or a state", async () => {
    const { invoice } = await convert();
    expect(invoice("178").placeOfSupply).toBe("07");
    expect(invoice("178").cgstAmount).toBe(3033);
    expect(invoice("178").igstAmount).toBe(0);
  });

  it("keeps IGST on a sale whose state the file does not give, and asks for the state", async () => {
    const { invoice } = await convert();
    expect(invoice("187").igstAmount).toBe(1602);
    expect(invoice("187").cgstAmount).toBe(0);
    expect(invoice("187").errors).toContain("Place of supply is required");
  });

  it("reports a bill's wrong tax under the law's, and tells the seller", async () => {
    const { invoice, result } = await convert();
    expect(invoice("197").igstAmount).toBe(3384);
    expect(invoice("197").cgstAmount).toBe(0);
    expect(
      result.statement.issues.some(
        (i) => i.severity === "WARNING" && /Invoice 197 charges CGST and SGST/.test(i.message)
      )
    ).toBe(true);
  });
});
