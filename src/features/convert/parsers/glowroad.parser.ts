import { BasePlatformParser, type ColumnMapping } from "./base.parser";
import type { NormalizedInvoiceRow, PlatformInfo } from "@/features/convert/types/convert.types";

export class GlowRoadParser extends BasePlatformParser {
  info: PlatformInfo = {
    id: "glowroad",
    name: "GlowRoad Seller Report",
    description: "Supports GlowRoad Reseller GST sales reports",
    iconName: "Sparkles",
    badge: "GlowRoad",
    accentColor: "from-emerald-500 to-teal-600",
  };

  autoMap(headers: string[]): ColumnMapping {
    const map: ColumnMapping = {};
    const norm = headers.map((h) => this.sanitizeHeader(h));
    headers.forEach((original, idx) => {
      const n = norm[idx]!;
      if (n.includes("order_no") || n.includes("invoice_no") || n.includes("order_id"))
        map.invoiceNumber = original;
      else if (n.includes("order_date") || n.includes("date")) map.invoiceDate = original;
      else if (n.includes("gstin") || n.includes("buyer_gstin")) map.buyerGstin = original;
      else if (n.includes("customer_name") || n.includes("buyer_name")) map.buyerName = original;
      else if (n.includes("state") || n.includes("delivery_state")) map.placeOfSupply = original;
      else if (n.includes("hsn")) map.hsnCode = original;
      else if (n.includes("qty") || n.includes("quantity")) map.quantity = original;
      else if (n.includes("taxable_value") || n.includes("taxable_amount"))
        map.taxableValue = original;
      else if (n.includes("cgst")) map.cgstAmount = original;
      else if (n.includes("sgst")) map.sgstAmount = original;
      else if (n.includes("igst")) map.igstAmount = original;
      else if (n.includes("total")) map.totalValue = original;
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
        this.getValue(row, mapping.invoiceNumber) || `GLW-INV-${index + 1}`
      ).trim();
      const invoiceDate = this.parseDate(this.getValue(row, mapping.invoiceDate));
      const buyerGstin = String(this.getValue(row, mapping.buyerGstin) || "")
        .trim()
        .toUpperCase();
      const buyerName = String(this.getValue(row, mapping.buyerName) || "GlowRoad Customer").trim();
      const pos = this.extractState(this.getValue(row, mapping.placeOfSupply), buyerGstin);
      const hsnCode = String(this.getValue(row, mapping.hsnCode) || "998313").trim();
      const quantity = this.parseNumber(this.getValue(row, mapping.quantity) || 1);
      const taxableValue = this.parseNumber(this.getValue(row, mapping.taxableValue));

      const isInterState = supplierState !== "" && pos !== "" && supplierState !== pos;
      let cgstAmount = this.parseNumber(this.getValue(row, mapping.cgstAmount));
      let sgstAmount = this.parseNumber(this.getValue(row, mapping.sgstAmount));
      let igstAmount = this.parseNumber(this.getValue(row, mapping.igstAmount));

      let cgstRate = 0,
        sgstRate = 0,
        igstRate = 0;
      if (isInterState) {
        igstRate = 18;
        if (igstAmount === 0) igstAmount = Math.round(taxableValue * 0.18 * 100) / 100;
      } else {
        cgstRate = 9;
        sgstRate = 9;
        if (cgstAmount === 0) cgstAmount = Math.round(taxableValue * 0.09 * 100) / 100;
        if (sgstAmount === 0) sgstAmount = Math.round(taxableValue * 0.09 * 100) / 100;
      }

      const totalValue =
        this.parseNumber(this.getValue(row, mapping.totalValue)) ||
        Math.round((taxableValue + cgstAmount + sgstAmount + igstAmount) * 100) / 100;
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
