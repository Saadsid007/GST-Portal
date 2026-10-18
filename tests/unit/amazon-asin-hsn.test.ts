import { describe, it, expect } from "vitest";
import { AmazonAdapter } from "@/features/convert/engine/adapters/amazon.adapter";
import { validateInvoices } from "@/features/convert/domain/validator";

const GSTIN = "09AFVPF7479N1Z9";
const context = {
  marketplace: "AMAZON",
  sourceId: "a",
  fileId: "mtr.csv",
  fileName: "MTR_B2C-SEPTEMBER-2026.csv",
  sourceRow: 0,
  sheetName: "Sheet1",
  reportType: "mtr",
  supplierGstin: GSTIN,
};

function mtr(over: Record<string, string>): Record<string, string> {
  return {
    "Seller Gstin": GSTIN,
    "Invoice Number": "IN-2400",
    "Invoice Date": "2026-09-03 09:47:28",
    "Transaction Type": "Shipment",
    "Order Id": "402-0074885-0830708",
    Quantity: "1",
    Asin: "B0CW1V993Q",
    "Hsn/sac": "442190",
    "Ship To State": "KARNATAKA",
    "Invoice Amount": "250",
    "Tax Exclusive Gross": "238.1",
    "Total Tax Amount": "11.9",
    "Igst Rate": "0.05",
    "Igst Tax": "11.9",
    ...over,
  };
}

describe("an FBA shipment Amazon left without an HSN code", () => {
  it("takes the code its ASIN carries everywhere else in the file", () => {
    const { transactions } = AmazonAdapter.adapt(
      [mtr({}), mtr({ "Invoice Number": "LKO1-191", "Hsn/sac": "" })],
      context
    );
    expect(transactions.find((t) => t.invoiceNumber === "LKO1-191")?.hsnCode).toBe("442190");
  });

  it("leaves it blank when the file codes that ASIN two ways", () => {
    const { transactions } = AmazonAdapter.adapt(
      [
        mtr({}),
        mtr({ "Invoice Number": "IN-2401", "Hsn/sac": "732690" }),
        mtr({ "Invoice Number": "LKO1-191", "Hsn/sac": "" }),
      ],
      context
    );
    expect(transactions.find((t) => t.invoiceNumber === "LKO1-191")?.hsnCode).toBe("");
  });

  it("tells the user a consumer sale without a code is missing from Table 12", () => {
    const { transactions } = AmazonAdapter.adapt(
      [mtr({ "Invoice Number": "LKO1-191", Asin: "B0OTHER", "Hsn/sac": "" })],
      context
    );
    const { issues } = validateInvoices(transactions, GSTIN);
    expect(issues.some((i) => i.severity === "WARNING" && /Table 12/.test(i.message))).toBe(true);
  });
});
