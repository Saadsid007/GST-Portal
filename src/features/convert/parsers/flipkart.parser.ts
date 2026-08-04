import { BasePlatformParser, type ColumnMapping } from "./base.parser";
import type { NormalizedInvoiceRow, PlatformInfo } from "@/features/convert/types/convert.types";

export class FlipkartParser extends BasePlatformParser {
  info: PlatformInfo = {
    id: "flipkart",
    name: "Flipkart Seller Report",
    description: "Supports Flipkart Seller Hub Sales & Return tax reports",
    iconName: "ShoppingCart",
    badge: "Flipkart Hub",
    accentColor: "from-blue-500 to-indigo-600",
  };

  autoMap(headers: string[]): ColumnMapping {
    const map: ColumnMapping = {};
    const norm = headers.map((h) => this.sanitizeHeader(h));

    headers.forEach((original, idx) => {
      const n = norm[idx]!;
      if (n.includes("invoice_id") || n.includes("invoice_number")) map.invoiceNumber = original;
      else if (n.includes("invoice_date")) map.invoiceDate = original;
      else if (n.includes("customer_gstin") || n.includes("buyer_gstin")) map.buyerGstin = original;
      else if (n.includes("customer_name") || n.includes("buyer_name")) map.buyerName = original;
      else if (
        n.includes("customer_state") ||
        n.includes("buyer_state") ||
        n.includes("delivery_state")
      )
        map.placeOfSupply = original;
      else if (n.includes("hsn")) map.hsnCode = original;
      else if (n.includes("quantity") || n.includes("qty")) map.quantity = original;
      else if (n.includes("taxable_value") || n.includes("taxable_amount"))
        map.taxableValue = original;
      else if (n.includes("cgst_rate")) map.cgstRate = original;
      else if (n.includes("sgst_rate")) map.sgstRate = original;
      else if (n.includes("igst_rate")) map.igstRate = original;
      else if (n.includes("cgst_amount")) map.cgstAmount = original;
      else if (n.includes("sgst_amount")) map.sgstAmount = original;
      else if (n.includes("igst_amount")) map.igstAmount = original;
      else if (n.includes("total_invoice_amount") || n.includes("invoice_amount"))
        map.totalValue = original;
    });

    return map;
  }

  parse(
    rawRows: Record<string, unknown>[],
    supplierGstin?: string,
    customMapping?: ColumnMapping
  ): NormalizedInvoiceRow[] {
    const headers = Object.keys(rawRows[0] || {});
    const mapping = customMapping || this.autoMap(headers);
    const supplierState = supplierGstin ? supplierGstin.substring(0, 2) : "";

    return rawRows.map((row, index) => {
      const invoiceNumber = String(
        this.getValue(row, mapping.invoiceNumber) ||
          this.getValue(row, "Invoice ID") ||
          this.getValue(row, "invoice_id") ||
          `FK-INV-${index + 1}`
      ).trim();
      const invoiceDate = this.parseDate(
        this.getValue(row, mapping.invoiceDate) ||
          this.getValue(row, "Invoice Date") ||
          this.getValue(row, "invoice_date")
      );
      const buyerGstin = String(
        this.getValue(row, mapping.buyerGstin) || this.getValue(row, "Customer GSTIN") || ""
      )
        .trim()
        .toUpperCase();
      const buyerName = String(
        this.getValue(row, mapping.buyerName) ||
          this.getValue(row, "Customer Name") ||
          "Flipkart Customer"
      ).trim();
      const pos = this.extractState(
        this.getValue(row, mapping.placeOfSupply) ||
          this.getValue(row, "Customer State") ||
          this.getValue(row, "delivery_state"),
        buyerGstin
      );
      const hsnCode = String(
        this.getValue(row, mapping.hsnCode) || this.getValue(row, "HSN") || "998313"
      ).trim();
      const quantity = this.parseNumber(
        this.getValue(row, mapping.quantity) || this.getValue(row, "Quantity") || 1
      );
      const taxableValue = this.parseNumber(
        this.getValue(row, mapping.taxableValue) || this.getValue(row, "Taxable Value")
      );

      let cgstRate = this.parseNumber(
        this.getValue(row, mapping.cgstRate) || this.getValue(row, "CGST Rate")
      );
      let sgstRate = this.parseNumber(
        this.getValue(row, mapping.sgstRate) || this.getValue(row, "SGST Rate")
      );
      let igstRate = this.parseNumber(
        this.getValue(row, mapping.igstRate) || this.getValue(row, "IGST Rate")
      );

      let cgstAmount = this.parseNumber(
        this.getValue(row, mapping.cgstAmount) || this.getValue(row, "CGST Amount")
      );
      let sgstAmount = this.parseNumber(
        this.getValue(row, mapping.sgstAmount) || this.getValue(row, "SGST Amount")
      );
      let igstAmount = this.parseNumber(
        this.getValue(row, mapping.igstAmount) || this.getValue(row, "IGST Amount")
      );

      const isInterState = supplierState !== "" && pos !== "" && supplierState !== pos;
      if (isInterState && igstRate === 0 && (cgstRate > 0 || sgstRate > 0)) {
        igstRate = cgstRate + sgstRate;
        cgstRate = 0;
        sgstRate = 0;
      }

      if (igstRate > 0 && igstAmount === 0)
        igstAmount = Math.round(taxableValue * (igstRate / 100) * 100) / 100;
      if (cgstRate > 0 && cgstAmount === 0)
        cgstAmount = Math.round(taxableValue * (cgstRate / 100) * 100) / 100;
      if (sgstRate > 0 && sgstAmount === 0)
        sgstAmount = Math.round(taxableValue * (sgstRate / 100) * 100) / 100;

      const totalValue =
        this.parseNumber(
          this.getValue(row, mapping.totalValue) || this.getValue(row, "Invoice Amount")
        ) || Math.round((taxableValue + cgstAmount + sgstAmount + igstAmount) * 100) / 100;
      const invoiceType = this.determineCategory(buyerGstin, taxableValue, supplierState, pos);

      return {
        id: `row-${index + 1}-${Date.now()}`,
        rowIndex: index + 2,
        invoiceNumber,
        invoiceDate,
        invoiceType,
        buyerName,
        buyerGstin,
        placeOfSupply: pos,
        hsnCode,
        quantity,
        taxableValue,
        cgstRate,
        sgstRate,
        igstRate,
        cessRate: 0,
        cgstAmount,
        sgstAmount,
        igstAmount,
        cessAmount: 0,
        totalValue,
        errors: [],
      };
    });
  }
}
