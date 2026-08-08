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

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class MeeshoAdapter {
  static adapt(rows: Record<string, string>[], context: SourceContext): AdapterResult {
    const transactions: NormalizedInvoiceRow[] = [];
    const unmappedColumns = new Set<string>();
    let validRows = 0;
    let errorRows = 0;

    const isReturnReport =
      context.reportType === "returns" || context.fileName.toLowerCase().includes("return");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];

      // 1. Transaction Type
      const rawTxType = (
        row["transaction_type"] ||
        row["Transaction Type"] ||
        row["Record Type"] ||
        ""
      )
        .trim()
        .toUpperCase();

      let txType: TransactionType = "Sales";
      if (
        isReturnReport ||
        rawTxType === "RETURN" ||
        rawTxType === "REFUND" ||
        Boolean(row["cancel_return_date"])
      ) {
        txType = "Return";
      } else if (rawTxType === "CANCELLED" || rawTxType === "CANCEL") {
        continue;
      }

      // 2. Identities
      const invoiceNumber = (
        row["sub_order_num"] ||
        row["sub_order_no"] ||
        row["Invoice Number"] ||
        row["identifier"] ||
        ""
      ).trim();

      const rawInvoiceDate = (
        row["order_date"] ||
        row["cancel_return_date"] ||
        row["manifest_date"] ||
        row["Invoice Date"] ||
        ""
      ).trim();

      const invoiceDate = transformDate(rawInvoiceDate) || rawInvoiceDate;

      const buyerGstin = (row["gstin"] || row["Customer GSTIN"] || row["Buyer Gstin"] || "").trim();

      const rawPos = (
        row["end_customer_state_new"] ||
        row["end_customer_state"] ||
        row["End Customer State"] ||
        row["Customer State"] ||
        row["State"] ||
        ""
      ).trim();

      const pos = transformStateCode(rawPos) || rawPos;

      const isB2B = Boolean(buyerGstin);

      let invoiceType: InvoiceCategory = isB2B ? "B2B" : "B2CS";
      if (txType === "Return") {
        invoiceType = "CDNR";
      }

      // 3. Taxable & Tax Values
      let taxableValue = parseFloat(
        row["total_taxable_sale_value"] || row["Taxable Value"] || row["Taxable Amount"] || "0"
      );
      taxableValue = round2(taxableValue);

      let totalTax = parseFloat(
        row["tax_amount"] || row["Tax Amount"] || row["IGST Amount"] || "0"
      );

      const rawIgst = parseFloat(row["IGST Amount"] || row["IGST"] || "0");
      const rawCgst = parseFloat(row["CGST Amount"] || row["CGST"] || "0");
      const rawSgst = parseFloat(row["SGST Amount"] || row["SGST"] || "0");
      const cessAmount = parseFloat(row["CESS Amount"] || row["Cess"] || "0");

      if (!totalTax) {
        totalTax = rawIgst + rawCgst + rawSgst + cessAmount;
      }
      totalTax = round2(totalTax);

      const totalValue = round2(
        parseFloat(
          row["total_invoice_value"] || row["Total Amount"] || row["Invoice Amount"] || "0"
        ) || taxableValue + totalTax
      );

      // 4. Rate
      let gstRate = parseFloat(row["gst_rate"] || row["GST Rate"] || row["Tax Rate"] || "0");
      if (!gstRate && Math.abs(taxableValue) > 0 && Math.abs(totalTax) > 0) {
        gstRate = Math.round((Math.abs(totalTax) / Math.abs(taxableValue)) * 100);
      }

      const validSlabs = [0, 5, 12, 18, 28];
      if (!validSlabs.includes(gstRate)) {
        gstRate = validSlabs.reduce(
          (prev, curr) => (Math.abs(curr - gstRate) < Math.abs(prev - gstRate) ? curr : prev),
          0
        );
      }

      const isInterState = rawIgst > 0 || (rawCgst === 0 && rawSgst === 0);

      let igstRate = 0;
      let cgstRate = 0;
      let sgstRate = 0;

      let igstAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;

      if (isInterState) {
        igstRate = gstRate;
        igstAmount = totalTax;
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmount = round2(totalTax / 2);
        sgstAmount = round2(totalTax / 2);
      }

      const cessRate = 0;

      // Returns mapping
      let originalInvoiceNumber = undefined;
      if (txType === "Return") {
        originalInvoiceNumber = row["Original Invoice Number"] || invoiceNumber;
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
        sourcePlatformId: "meesho",
        sourcePlatformName: "Meesho Supplier Panel",
        sourceFileName: context.fileName,
        sourceFileType: context.reportType,
        transactionType: txType,

        invoiceNumber,
        invoiceDate,
        invoiceType,

        buyerName: row["sup_name"] || "Meesho Customer",
        buyerGstin,
        placeOfSupply: pos,

        itemDescription: row["Product Name"] || row["Item Description"] || "",
        hsnCode: row["hsn_code"] || row["HSN Code"] || row["HSN"] || "",
        uqc: "NOS",
        quantity: parseInt(row["quantity"] || row["Quantity"] || "1", 10) || 1,

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

        ecoGstin: row["eco_tcs_gstin"] || "09AARCM9332R1CM",
        ecoName: "Meesho",

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
