import type { AdapterResult, SourceContext } from "./types";
import type {
  NormalizedInvoiceRow,
  InvoiceCategory,
  TransactionType,
} from "@/features/convert/types/convert.types";
import {
  transformStateCode,
  transformDate,
} from "@/features/convert/engine/transformation/transformers";

export class FlipkartAdapter {
  static adapt(rows: Record<string, string>[], context: SourceContext): AdapterResult {
    const transactions: NormalizedInvoiceRow[] = [];
    const unmappedColumns = new Set<string>();
    let validRows = 0;
    let errorRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];

      // 1. Transaction Type
      const rawTxType = (row["Transaction Type"] || row["Event Type"] || "").trim().toUpperCase();
      let txType: TransactionType = "Sales";
      if (rawTxType === "RETURN" || rawTxType === "REFUND") {
        txType = "Return";
      } else if (rawTxType === "CANCELLED" || rawTxType === "CANCEL") {
        continue;
      }

      // 2. Identities
      const invoiceNumber = (row["Invoice Number"] || "").trim();
      const rawInvoiceDate = (row["Invoice Date"] || "").trim();
      const invoiceDate = transformDate(rawInvoiceDate) || rawInvoiceDate;

      const buyerGstin = (row["Buyer Gstin"] || row["Customer GSTIN"] || "").trim();
      const rawPos = (row["Customer State"] || row["Delivery State"] || "").trim();
      const pos = transformStateCode(rawPos) || rawPos;

      const isB2B = Boolean(buyerGstin);

      let invoiceType: InvoiceCategory = isB2B ? "B2B" : "B2CS";
      if (txType === "Return") {
        invoiceType = "CDNR";
      }

      // 3. Taxable & Tax Values
      const taxableValue = parseFloat(row["Taxable Value"] || row["Taxable Amount"] || "0");

      const igstAmount = parseFloat(row["IGST"] || "0");
      const cgstAmount = parseFloat(row["CGST"] || "0");
      const sgstAmount = parseFloat(row["SGST"] || "0");
      const cessAmount = parseFloat(row["CESS"] || "0");

      const totalTax = igstAmount + cgstAmount + sgstAmount + cessAmount;
      const totalValue =
        parseFloat(row["Invoice Amount"] || row["Total Amount"] || "0") || taxableValue + totalTax;

      // 4. Rate
      let gstRate = parseFloat(row["GST Rate"] || row["Tax Rate"] || "0");
      if (!gstRate && taxableValue !== 0 && totalTax !== 0) {
        gstRate = Math.round((totalTax / taxableValue) * 100);
      }

      const validSlabs = [0, 5, 12, 18, 28];
      if (!validSlabs.includes(gstRate)) {
        gstRate = validSlabs.reduce(
          (prev, curr) => (Math.abs(curr - gstRate) < Math.abs(prev - gstRate) ? curr : prev),
          0
        );
      }

      const isInterState = igstAmount > 0 || (!cgstAmount && !sgstAmount);
      const igstRate = isInterState ? gstRate : 0;
      const cgstRate = !isInterState ? gstRate / 2 : 0;
      const sgstRate = !isInterState ? gstRate / 2 : 0;
      const cessRate = 0;

      // Returns mapping
      let originalInvoiceNumber = undefined;
      if (txType === "Return") {
        originalInvoiceNumber =
          row["Original Invoice Number"] || row["Invoice Number"] || undefined;
      }

      // Validation
      if (!invoiceNumber) {
        errors.push("Missing Invoice Number");
      }
      if (!invoiceDate) {
        errors.push("Missing Invoice Date");
      }
      if (!pos) {
        errors.push("Missing Place of Supply");
      }

      const tx: NormalizedInvoiceRow = {
        id: crypto.randomUUID(),
        rowIndex: i + 1,
        sourcePlatformId: "flipkart",
        sourcePlatformName: "Flipkart",
        sourceFileName: context.fileName,
        sourceFileType: context.reportType,
        transactionType: txType,

        invoiceNumber,
        invoiceDate,
        invoiceType,

        buyerName: "Flipkart Customer",
        buyerGstin,
        placeOfSupply: pos,

        itemDescription: row["Item Description"] || "",
        hsnCode: row["HSN"] || "",
        uqc: "NOS",
        quantity: parseInt(row["Quantity"] || "1", 10) || 1,

        taxableValue,
        igstAmount,
        cgstAmount,
        sgstAmount,
        cessAmount,
        totalValue,

        igstRate,
        cgstRate,
        sgstRate,
        cessRate,

        ecoGstin: "29XXXXXFLIPKART", // Placeholder
        ecoName: "Flipkart",

        originalInvoiceNumber,
        errors,
      };

      if (errors.length > 0) {
        errorRows++;
      } else {
        validRows++;
      }

      transactions.push(tx);
    }

    return {
      sourceContext: context,
      transactions,
      unmappedColumns: Array.from(unmappedColumns),
      totalRows: rows.length,
      validRows,
      errorRows,
    };
  }
}
