import { BasePlatformParser, type ColumnMapping } from "./base.parser";
import type { NormalizedInvoiceRow, PlatformInfo } from "@/features/convert/types/convert.types";

export class MeeshoParser extends BasePlatformParser {
  info: PlatformInfo = {
    id: "meesho",
    name: "Meesho Supplier Report",
    description: "Supports Meesho Supplier Panel Tax & Order Reports",
    iconName: "Store",
    badge: "Meesho Panel",
    accentColor: "from-pink-500 to-rose-600",
  };

  autoMap(headers: string[]): ColumnMapping {
    const map: ColumnMapping = {};
    const norm = headers.map((h) => this.sanitizeHeader(h));

    headers.forEach((original, idx) => {
      const n = norm[idx]!;
      // Invoice number — Meesho TCS uses sub_order_num
      if (
        n === "sub_order_num" ||
        n.includes("sub_order_no") ||
        n.includes("order_id") ||
        n.includes("invoice_no")
      )
        map.invoiceNumber = original;
      // Date
      else if (n === "order_date" || n.includes("invoice_date")) map.invoiceDate = original;
      // GSTIN — Meesho TCS uses gstin (supplier's own GSTIN, not buyer)
      // buyer GSTIN not present in TCS report — skip to avoid wrong mapping
      else if (
        (n.includes("customer_gstin") || n === "buyer_gstin") &&
        n !== "gstin" &&
        n !== "eco_tcs_gstin"
      )
        map.buyerGstin = original;
      // Buyer name
      else if (n.includes("customer_name") || n.includes("reseller_name")) map.buyerName = original;
      // Place of supply — Meesho TCS uses end_customer_state_new
      else if (
        n === "end_customer_state_new" ||
        n === "end_customer_state" ||
        n === "state" ||
        n.includes("customer_state")
      )
        map.placeOfSupply = original;
      // HSN
      else if (n === "hsn_code" || n.includes("hsn")) map.hsnCode = original;
      // Quantity
      else if (n === "quantity" || n.includes("qty")) map.quantity = original;
      // Taxable value — Meesho TCS uses total_taxable_sale_value
      else if (
        n === "total_taxable_sale_value" ||
        n.includes("taxable_amount") ||
        n.includes("taxable_value") ||
        n.includes("supplier_discounted_price")
      )
        map.taxableValue = original;
      // Tax rate — Meesho TCS uses gst_rate
      else if (n === "gst_rate" || n.includes("tax_rate")) map.igstRate = original;
      // Tax amounts — Meesho TCS uses tax_amount (total tax, not split)
      else if (n === "tax_amount") map.igstAmount = original;
      else if (n.includes("cgst")) map.cgstAmount = original;
      else if (n.includes("sgst")) map.sgstAmount = original;
      else if (n.includes("igst_amount")) map.igstAmount = original;
      // Total
      else if (
        n === "total_invoice_value" ||
        n.includes("total_amount") ||
        n.includes("order_total")
      )
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
      // Invoice number — TCS uses sub_order_num (can be 20+ chars, GSTR-1 limit is 16)
      // We take last 16 chars which preserves uniqueness
      const rawInvoiceNum = String(
        this.getValue(row, mapping.invoiceNumber) ||
          this.getValue(row, "sub_order_num") ||
          this.getValue(row, "Order No") ||
          `MSH-INV-${index + 1}`
      ).trim();
      const invoiceNumber = rawInvoiceNum.length > 16 ? rawInvoiceNum.slice(-16) : rawInvoiceNum;

      // Date
      const invoiceDate = this.parseDate(
        this.getValue(row, mapping.invoiceDate) ||
          this.getValue(row, "order_date") ||
          this.getValue(row, "Order Date")
      );

      // For Meesho TCS B2C — buyer GSTIN is not in the file
      const buyerGstin = String(this.getValue(row, mapping.buyerGstin) || "")
        .trim()
        .toUpperCase();

      // Buyer name — TCS report doesn't have customer name; use supplier name as seller
      const buyerName = String(
        this.getValue(row, mapping.buyerName) ||
          this.getValue(row, "Customer Name") ||
          "Meesho Customer"
      ).trim();

      // Place of supply — prioritise end_customer_state_new (state name like MAHARASHTRA)
      const posRaw =
        this.getValue(row, mapping.placeOfSupply) ||
        this.getValue(row, "end_customer_state_new") ||
        this.getValue(row, "end_customer_state") ||
        this.getValue(row, "State");
      // extractState handles state name→code and GSTIN→code conversion
      const pos = this.extractState(posRaw, buyerGstin || undefined);

      // HSN
      const hsnCode = String(
        this.getValue(row, mapping.hsnCode) ||
          this.getValue(row, "hsn_code") ||
          this.getValue(row, "HSN") ||
          "998313"
      ).trim();

      // Quantity
      const quantity = this.parseNumber(
        this.getValue(row, mapping.quantity) ||
          this.getValue(row, "quantity") ||
          this.getValue(row, "Qty") ||
          1
      );

      // Taxable value — TCS uses total_taxable_sale_value
      const taxableValue = this.parseNumber(
        this.getValue(row, mapping.taxableValue) ||
          this.getValue(row, "total_taxable_sale_value") ||
          this.getValue(row, "Taxable Amount")
      );

      // GST rate
      const gstRate = this.parseNumber(
        this.getValue(row, mapping.igstRate) ||
          this.getValue(row, "gst_rate") ||
          this.getValue(row, "GST Rate") ||
          18
      );

      const isInterState = supplierState !== "" && pos !== "" && supplierState !== pos;

      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;

      if (isInterState) {
        igstRate = gstRate;
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
      }

      // Tax amounts — Meesho TCS has only tax_amount (total), split accordingly
      // mapping.igstAmount maps to tax_amount (total tax), not IGST specifically
      const totalTaxAmount = this.parseNumber(this.getValue(row, "tax_amount"));

      // Try platform-specific individual tax columns (non-TCS Meesho formats)
      let cgstAmount = this.parseNumber(this.getValue(row, mapping.cgstAmount));
      let sgstAmount = this.parseNumber(this.getValue(row, mapping.sgstAmount));
      // igstAmount: only use if it's a dedicated IGST column (not tax_amount which is total)
      const hasIndividualTaxCols =
        (mapping.cgstAmount || mapping.sgstAmount) && mapping.igstAmount !== mapping.cgstAmount;
      let igstAmount = hasIndividualTaxCols
        ? this.parseNumber(this.getValue(row, mapping.igstAmount))
        : 0;

      // If totalTaxAmount is available, use it to split correctly
      if (totalTaxAmount > 0 && cgstAmount === 0 && sgstAmount === 0 && igstAmount === 0) {
        if (isInterState) {
          igstAmount = totalTaxAmount;
        } else {
          cgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;
          sgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;
        }
      } else if (cgstAmount === 0 && sgstAmount === 0 && igstAmount === 0) {
        // Calculate from rate as fallback
        if (igstRate > 0) igstAmount = Math.round(taxableValue * (igstRate / 100) * 100) / 100;
        if (cgstRate > 0) cgstAmount = Math.round(taxableValue * (cgstRate / 100) * 100) / 100;
        if (sgstRate > 0) sgstAmount = Math.round(taxableValue * (sgstRate / 100) * 100) / 100;
      }

      const totalValue =
        this.parseNumber(this.getValue(row, mapping.totalValue)) ||
        this.parseNumber(this.getValue(row, "total_invoice_value")) ||
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
