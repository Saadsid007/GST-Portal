import { describe, it, expect } from "vitest";
import {
  fingerprintHeaders,
  mappingFitsHeaders,
} from "@/features/convert/domain/column-fingerprint";

const MEESHO = [
  "identifier",
  "sup_name",
  "gstin",
  "sub_order_num",
  "order_date",
  "hsn_code",
  "quantity",
  "gst_rate",
  "total_taxable_sale_value",
];

describe("identifying a file by its header set", () => {
  it("gives the same id to the same export twice", () => {
    // This is the whole point: last month's Meesho file and this month's are
    // the same shape, so the mapping confirmed then applies now.
    expect(fingerprintHeaders(MEESHO)).toBe(fingerprintHeaders([...MEESHO]));
  });

  it("ignores case, spacing and punctuation", () => {
    // The same report is spelled "Taxable Value", "taxable_value" and
    // "Taxable Value Rs." across exports of one marketplace.
    const a = ["Taxable Value", "Invoice Number", "HSN Code"];
    const b = ["taxable_value", "invoice number", "hsn-code"];

    expect(fingerprintHeaders(a)).toBe(fingerprintHeaders(b));
  });

  it("ignores column order", () => {
    const reordered = [...MEESHO].reverse();

    expect(fingerprintHeaders(reordered)).toBe(fingerprintHeaders(MEESHO));
  });

  it("treats a file with an added column as unseen", () => {
    // Deliberate. A near-match would apply last month's mapping to a column
    // that moved, and a mapping on the wrong column produces a filed return
    // that is quietly wrong — worse than one more question.
    expect(fingerprintHeaders([...MEESHO, "tcs_igst_amount"])).not.toBe(fingerprintHeaders(MEESHO));
  });

  it("tells two different marketplaces apart", () => {
    const amazon = ["Seller Gstin", "Invoice Number", "Shipment Id", "Asin"];

    expect(fingerprintHeaders(amazon)).not.toBe(fingerprintHeaders(MEESHO));
  });

  it("refuses to identify a file too thin to be a report", () => {
    // Two columns cannot identify a format, and remembering one would collide
    // with every other fragment.
    expect(fingerprintHeaders(["a", "b"])).toBeNull();
    expect(fingerprintHeaders([])).toBeNull();
    expect(fingerprintHeaders(["", "  ", "x"])).toBeNull();
  });
});

describe("checking a remembered mapping still fits", () => {
  const mapping = { invoiceNumber: "sub_order_num", taxableValue: "total_taxable_sale_value" };

  it("accepts a mapping whose columns are all present", () => {
    expect(mappingFitsHeaders(mapping, MEESHO)).toBe(true);
  });

  it("rejects one naming a column that is gone", () => {
    // A profile can outlive the export it was saved against.
    expect(mappingFitsHeaders({ ...mapping, hsnCode: "commodity_code" }, MEESHO)).toBe(false);
  });

  it("compares names the same way the fingerprint does", () => {
    expect(mappingFitsHeaders({ taxableValue: "Total Taxable Sale Value" }, MEESHO)).toBe(true);
  });
});
