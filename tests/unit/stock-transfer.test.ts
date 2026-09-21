import { describe, it, expect } from "vitest";
import {
  isStockTransferRow,
  excludeStockTransfers,
  isReportableTransfer,
  summariseStockTransfers,
} from "@/features/convert/domain/stock-transfer";
import { validateInvoices, isValidGstin } from "@/features/convert/domain/validator";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

const SELLER = "09KLJPS4652C1ZN";

function row(over: Partial<NormalizedInvoiceRow> = {}): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    transactionType: "Sales",
    invoiceNumber: "IN-1",
    invoiceDate: "2026-08-01",
    invoiceType: "B2B",
    buyerName: "Customer",
    buyerGstin: "06AARPM2103R1ZB",
    placeOfSupply: "06",
    hsnCode: "441900",
    itemDescription: "Wooden tray",
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

describe("recognising a movement of the seller's own stock", () => {
  it("catches a document to another registration of the same PAN", () => {
    // A delivery challan extracted from a PDF arrives typed B2B with the
    // seller's Haryana branch as the buyer. Only the PAN test catches it, and
    // the Excel generator did not have that test — so it declared the branch
    // transfer as a sale while the JSON of the same return left it out.
    expect(isStockTransferRow(row({ buyerGstin: "06KLJPS4652C1ZT" }), SELLER)).toBe(true);
  });

  it("leaves a genuine sale to an outside business alone", () => {
    expect(isStockTransferRow(row({ buyerGstin: "06AARPM2103R1ZB" }), SELLER)).toBe(false);
  });

  it("catches the marketplace transfer feeds by platform, file and series", () => {
    expect(isStockTransferRow(row({ sourcePlatformId: "amazon_stock_transfer" }), SELLER)).toBe(
      true
    );
    expect(
      isStockTransferRow(row({ sourceFileName: "MTR_STOCK_TRANSFER-AUGUST-2026.csv" }), SELLER)
    ).toBe(true);
    expect(isStockTransferRow(row({ invoiceNumber: "LKO1-T-9" }), SELLER)).toBe(true);
    expect(isStockTransferRow(row({ invoiceNumber: "AFT-4471" }), SELLER)).toBe(true);
  });

  it("does not call a row a transfer just because the buyer is unregistered", () => {
    // Both PANs empty must not compare equal, or every B2C row in the return
    // would be held back as a transfer.
    expect(isStockTransferRow(row({ buyerGstin: "", invoiceType: "B2CS" }), SELLER)).toBe(false);
    expect(isStockTransferRow(row({ buyerGstin: "" }), "")).toBe(false);
  });

  it("reports an untaxed movement it held back", () => {
    const untaxed = row({
      buyerGstin: "06KLJPS4652C1ZT",
      taxableValue: 18714.29,
      igstRate: 0,
      igstAmount: 0,
    });
    const rows = [untaxed, row({ buyerGstin: "06AARPM2103R1ZB", taxableValue: 1000 })];

    expect(excludeStockTransfers(rows, SELLER)).toHaveLength(1);
    expect(summariseStockTransfers(rows, SELLER)).toEqual({ rows: 1, taxableValue: 18714.29 });
  });
});

describe("whether a transfer belongs in the return", () => {
  // Schedule I treats two registrations of one business as distinct persons,
  // so a supply between them is a supply. When the seller has charged tax on
  // it, it is an outward supply of this return and goes in Table 4 — which is
  // what the filed returns do. Holding every branch transfer back understated
  // one month's B2B by 19 invoices against the return the CA filed.
  it("reports a transfer the seller charged tax on", () => {
    const taxed = row({ buyerGstin: "06KLJPS4652C1ZT", igstRate: 5, igstAmount: 935.71 });

    expect(isReportableTransfer(taxed, SELLER)).toBe(true);
    expect(excludeStockTransfers([taxed], SELLER)).toHaveLength(1);
  });

  it("holds back a movement carrying no tax", () => {
    // Goods sent under a delivery challan for job work or on approval are a
    // movement, not a supply. The tax on the document is what separates the
    // two — the wording says "Stock Transfer" either way.
    const untaxed = row({
      buyerGstin: "06KLJPS4652C1ZT",
      igstRate: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
    });

    expect(isReportableTransfer(untaxed, SELLER)).toBe(false);
    expect(excludeStockTransfers([untaxed], SELLER)).toHaveLength(0);
  });
});

describe("what a transfer is allowed to block", () => {
  it("does not fail a return because a transfer feed carries no HSN", () => {
    // Amazon's stock transfer export has no HSN column at all, so ten rows
    // the return never reports each raised a blocking error the user could
    // do nothing about. It stays visible as a review item instead.
    const transfer = row({
      invoiceNumber: "LKO1-T-9",
      buyerGstin: "06KLJPS4652C1ZT",
      hsnCode: "",
      igstRate: 0,
      igstAmount: 0,
    });
    const sale = row({ invoiceNumber: "VJFV-876", buyerGstin: "06AAHCI5526K1ZD", hsnCode: "" });

    const result = validateInvoices([transfer, sale], SELLER);
    const blockedOnHsn = result.rows.filter((r) => r.errors.some((e) => e.includes("HSN")));

    expect(blockedOnHsn.map((r) => r.invoiceNumber)).toEqual(["VJFV-876"]);
    expect(result.rows[0]!.reviews).toContain(
      "No HSN code — not needed, this moves your own stock between your GSTINs"
    );
  });

  it("names the code the rest of the upload uses, without applying it", () => {
    // Evidence the user can act on in one edit. Choosing it for them would be
    // a guess wearing a number — the declaration stays theirs.
    const rows = [
      ...Array.from({ length: 9 }, (_, i) =>
        row({ invoiceNumber: `IN-${i}`, buyerGstin: "06AAHCI5526K1ZD", hsnCode: "441900" })
      ),
      row({ invoiceNumber: "VJFV-876", buyerGstin: "06AAHCI5526K1ZD", hsnCode: "" }),
    ];

    const failing = validateInvoices(rows, SELLER).rows.find((r) => r.errors.length > 0);

    expect(failing!.errors[0]).toContain("441900");
    expect(failing!.hsnCode).toBe("");
  });
});

describe("a GSTIN that is the right shape but the wrong number", () => {
  it("catches a transposition the format check cannot", () => {
    // A seller's own invoice template printed "24ABQPM0946Q1ZJ" where the
    // buyer's registration is "24AQBPM0946Q1ZJ" — two letters swapped, a
    // valid shape, a different business. Filed that way the buyer cannot
    // claim the credit. Three of the 77,792 GSTINs in the sample corpus fail
    // this, and all three are typed by hand.
    expect(isValidGstin("24AQBPM0946Q1ZJ")).toBe(true);
    expect(isValidGstin("24ABQPM0946Q1ZJ")).toBe(false);
  });

  it("still rejects something that is not a GSTIN at all", () => {
    expect(isValidGstin("09ABC")).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });

  it("reports the two failures differently", () => {
    const typo = row({ buyerGstin: "24ABQPM0946Q1ZJ" });
    const garbage = row({ buyerGstin: "NOT-A-GSTIN" });

    const result = validateInvoices([typo, garbage], SELLER);

    expect(result.rows[0]!.errors.join(" ")).toContain("check digit");
    expect(result.rows[1]!.errors.join(" ")).toContain("Invalid GSTIN format");
  });
});
