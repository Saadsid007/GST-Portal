import { describe, it, expect } from "vitest";
import { ownGstinRole } from "@/features/pdf-extractor/domain/party-role";

const OWN = "27AAJCP8507D1ZC";

describe("whether a PDF is a bill the seller received", () => {
  it("knows a marketplace's fee invoice: its GSTIN heads the page, the seller's is billed", () => {
    const text = [
      "Tax Invoice",
      "Amazon Seller Services Private Limited",
      "GST Tax Registration No: 29AAICA3918J1ZE",
      "Bill to",
      "Name: PRODEGINS CREATORSPACES PRIVATE LIMITED",
      `GSTIN: ${OWN}`,
      "1. 998599 Fixed Closing Fee INR 2172.00",
    ].join("\n");
    expect(ownGstinRole(text, OWN)).toBe("recipient");
  });

  it("knows a supplier's bill whose own GSTIN is printed only at the foot", () => {
    const text = [
      "YASH ENTERPRISES",
      "Buyer ( Bill to ) Invoice No : 3347",
      "M/ S PRODEGINS CREATORSPACES PVT LTD",
      "Consignee ( Ship To)",
      `STATE CODE : MH GSTIN NUMBER : ${OWN}`,
      "7800 Envelope 48201010 18% 10.00 78000.00",
      "GST NUMBER : 27AWRPP5842Q1ZD",
    ].join("\n");
    expect(ownGstinRole(text, OWN)).toBe("recipient");
  });

  it("knows a gateway's charges addressed 'To,' and a foreign platform's bill", () => {
    const paypal = [
      "Tax Invoice",
      "To,",
      "PRODEGINS CREATORSPACES PRIVATE LIMITED",
      `GSTIN/Unique ID: ${OWN}`,
      "27AAGCP4442G1ZF",
    ].join("\n");
    const shopify = [
      "TOTAL DUE ₹608.98 INR",
      "Account billed",
      "Prodegins Creatorspaces Pvt. Ltd.",
      "Maharashtra - 27",
      OWN,
      "Shopify Commerce Singapore Pte. Ltd.",
    ].join("\n");
    expect(ownGstinRole(paypal, OWN)).toBe("recipient");
    expect(ownGstinRole(shopify, OWN)).toBe("recipient");
  });

  it("keeps a sale whose two-column header flattens 'Ship from' and 'Ship to' together", () => {
    const text = [
      "DELIVERY CHALLAN/ TAX INVOICE",
      "Ship from : Ship to :",
      "Antique Store",
      "GSTIN : 09KLJPS4652C1ZN",
      "ASSPL - Haryana",
      "GSTIN : 06KLJPS4652C1ZT",
    ].join("\n");
    expect(ownGstinRole(text, "09KLJPS4652C1ZN")).toBe("supplier");
  });

  it("keeps a Vendor Central invoice whose seller GSTIN falls under 'BILL TO'", () => {
    const text = [
      "SHIP FROM / BILL FROM",
      "WOOD ART STORE",
      "BILL TO",
      "Etrade Marketing Pvt Ltd",
      "09BHCPS1644C1ZI",
      "GST ID GST ID",
      "09AADCV4254H1Z6",
    ].join("\n");
    expect(ownGstinRole(text, "09BHCPS1644C1ZI")).toBe("supplier");
  });

  it("keeps the seller's own sale to a consumer, whatever its letterhead says", () => {
    const text = [
      "Customer care: 1800 123 4567",
      `GSTIN: ${OWN}`,
      "Bill to: Ravi Kumar, Pune",
      "Invoice No: INV2610",
    ].join("\n");
    expect(ownGstinRole(text, OWN)).toBe("supplier");
    expect(ownGstinRole("no registration here", OWN)).toBe("absent");
  });
});
