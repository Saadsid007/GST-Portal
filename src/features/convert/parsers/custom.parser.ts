import { BasePlatformParser, type ColumnMapping } from "./base.parser";
import type { NormalizedInvoiceRow, PlatformInfo } from "@/features/convert/types/convert.types";

export class CustomParser extends BasePlatformParser {
  info: PlatformInfo = {
    id: "custom",
    name: "Custom Excel",
    description: "Upload any Excel or CSV file — auto-detect columns or map manually",
    iconName: "FileSpreadsheet",
    badge: "Custom",
    accentColor: "from-slate-500 to-gray-600",
  };

  autoMap(headers: string[]): ColumnMapping {
    const map: ColumnMapping = {};
    const norm = headers.map((h) => this.sanitizeHeader(h));

    headers.forEach((original, idx) => {
      const n = norm[idx]!;
      if (
        n.includes("invoice_number") ||
        n.includes("invoice_no") ||
        n.includes("invoice_id") ||
        n.includes("bill_no") ||
        n.includes("bill_number")
      )
        map.invoiceNumber = original;
      else if (n.includes("invoice_date") || n.includes("bill_date") || n.includes("date"))
        map.invoiceDate = original;
      else if (
        n.includes("buyer_gstin") ||
        n.includes("customer_gstin") ||
        n.includes("party_gstin") ||
        n.includes("gstin")
      )
        map.buyerGstin = original;
      else if (
        n.includes("buyer_name") ||
        n.includes("customer_name") ||
        n.includes("party_name") ||
        n.includes("customer")
      )
        map.buyerName = original;
      else if (
        n.includes("place_of_supply") ||
        n.includes("delivery_state") ||
        n.includes("state") ||
        n.includes("pos")
      )
        map.placeOfSupply = original;
      else if (n.includes("hsn") || n.includes("hsn_code") || n.includes("hsn_sac"))
        map.hsnCode = original;
      else if (n.includes("quantity") || n.includes("qty") || n.includes("units"))
        map.quantity = original;
      else if (
        n.includes("taxable_value") ||
        n.includes("taxable_amount") ||
        n.includes("base_amount") ||
        n.includes("taxable")
      )
        map.taxableValue = original;
      else if (n.includes("cgst_rate")) map.cgstRate = original;
      else if (n.includes("sgst_rate")) map.sgstRate = original;
      else if (n.includes("igst_rate")) map.igstRate = original;
      else if (n.includes("cgst_amount") || n.includes("cgst")) map.cgstAmount = original;
      else if (n.includes("sgst_amount") || n.includes("sgst")) map.sgstAmount = original;
      else if (n.includes("igst_amount") || n.includes("igst")) map.igstAmount = original;
      else if (
        n.includes("total_amount") ||
        n.includes("total_value") ||
        n.includes("invoice_amount") ||
        n.includes("grand_total") ||
        n.includes("total")
      )
        map.totalValue = original;
      else if (n.includes("original_invoice_number") || n.includes("original_invoice_no"))
        map.originalInvoiceNumber = original;
      else if (n.includes("original_invoice_date")) map.originalInvoiceDate = original;
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
          this.getValue(row, "Invoice Number") ||
          `CUST-INV-${index + 1}`
      ).trim();
      const invoiceDate = this.parseDate(
        this.getValue(row, mapping.invoiceDate) || this.getValue(row, "Invoice Date")
      );
      const buyerGstin = String(
        this.getValue(row, mapping.buyerGstin) || this.getValue(row, "Buyer GSTIN") || ""
      )
        .trim()
        .toUpperCase();
      const buyerName = String(
        this.getValue(row, mapping.buyerName) || this.getValue(row, "Buyer Name") || "Customer"
      ).trim();
      const pos = this.extractState(
        this.getValue(row, mapping.placeOfSupply) || this.getValue(row, "Place of Supply"),
        buyerGstin
      );
      const hsnCode = String(
        this.getValue(row, mapping.hsnCode) || this.getValue(row, "HSN Code") || "998313"
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

      const originalInvoiceNumber = mapping.originalInvoiceNumber
        ? String(this.getValue(row, mapping.originalInvoiceNumber) || "").trim()
        : undefined;
      const originalInvoiceDate = mapping.originalInvoiceDate
        ? this.parseDate(this.getValue(row, mapping.originalInvoiceDate))
        : undefined;

      const totalValue =
        this.parseNumber(
          this.getValue(row, mapping.totalValue) || this.getValue(row, "Total Amount")
        ) || Math.round((taxableValue + cgstAmount + sgstAmount + igstAmount) * 100) / 100;
      const isReturn = !!(originalInvoiceNumber || taxableValue < 0);
      const invoiceType = this.determineCategory(
        buyerGstin,
        taxableValue,
        supplierState,
        pos,
        isReturn
      );

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
        originalInvoiceNumber,
        originalInvoiceDate,
        errors: [],
      };
    });
  }
}
