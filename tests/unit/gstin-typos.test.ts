import { describe, it, expect } from "vitest";
import { suggestGstinCorrection, validateInvoices } from "@/features/convert/domain/validator";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

describe("a GSTIN typed wrong on a bill", () => {
  it("names the one registration it was meant to be", () => {
    // Each from a real bill; the first two are what the accountant filed.
    expect(suggestGstinCorrection("09AFXPK9825PIZ4")).toBe("09AFXPK9825P1Z4");
    expect(suggestGstinCorrection("09EMOPR4227N1ZS")).toBe("09EMOPR4227N1Z5");
    expect(suggestGstinCorrection("09AASCM4127D12C")).toBe("09AASCM4127D1ZC");
    expect(suggestGstinCorrection("24ABQPM0946Q1ZJ")).toBe("24AQBPM0946Q1ZJ");
  });

  it("suggests nothing for one that is already right, or too far off", () => {
    expect(suggestGstinCorrection("09AFXPK9825P1Z4")).toBeNull();
    expect(suggestGstinCorrection("09XXXXX0000X1Z0")).toBeNull();
  });
});

describe("a bill whose buyer is the seller", () => {
  const SELLER = "09BUBPA8966R1ZS";
  const purchase = {
    id: "1",
    rowIndex: 1,
    sourcePlatformId: "offline",
    sourcePlatformName: "Offline & Direct Invoices",
    sourceFileName: "KA-2627-1044126.pdf",
    sourceFileType: "offline_invoices",
    transactionType: "Sales",
    invoiceNumber: "KA-2627-1044126",
    invoiceDate: "2026-06-12",
    invoiceType: "B2B",
    buyerName: "INDIA BIG SHOP",
    buyerGstin: SELLER,
    placeOfSupply: "09",
    itemDescription: "Courier",
    hsnCode: "996812",
    uqc: "OTH",
    quantity: 1,
    totalValue: 70.8,
    taxableValue: 60,
    igstRate: 0,
    cgstRate: 9,
    sgstRate: 9,
    cessRate: 0,
    igstAmount: 0,
    cgstAmount: 5.4,
    sgstAmount: 5.4,
    cessAmount: 0,
    errors: [],
    reviews: [],
  } satisfies NormalizedInvoiceRow;

  it("is held out as a purchase, not filed as a sale", () => {
    const { rows } = validateInvoices([purchase], SELLER);
    expect(rows[0]!.errors.join(" ")).toMatch(/bill you received, not a sale/);
  });
});
