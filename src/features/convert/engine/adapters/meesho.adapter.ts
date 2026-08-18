import type { AdapterResult, SourceContext } from "./types";
import type {
  NormalizedInvoiceRow,
  InvoiceCategory,
  TransactionType,
} from "@/features/convert/types/convert.types";
import {
  transformStateCode,
  transformDate,
  transformHsn,
} from "@/features/convert/engine/transformation/transformers";
import { resolveEcoGstin } from "@/features/convert/config/eco-registry";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class MeeshoAdapter {
  static adapt(rows: Record<string, string>[], context: SourceContext): AdapterResult {
    const transactions: NormalizedInvoiceRow[] = [];
    const unmappedColumns = new Set<string>();
    let _validRows = 0;
    let _errorRows = 0;

    const isReturnReport =
      context.reportType === "returns" ||
      context.reportType === "tcs_sales_return" ||
      context.fileName.toLowerCase().includes("return");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];

      // 6. Taxable & Tax Values
      const rawTaxableValNum = parseFloat(
        row["total_taxable_sale_value"] || row["Taxable Value"] || row["Taxable Amount"] || "0"
      );
      const rawTaxNum = parseFloat(
        row["tax_amount"] || row["Tax Amount"] || row["IGST Amount"] || "0"
      );

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
        Boolean(row["cancel_return_date"]) ||
        rawTaxableValNum < 0 ||
        rawTaxNum < 0
      ) {
        txType = "Return";
      } else if (rawTxType === "CANCELLED" || rawTxType === "CANCEL") {
        continue;
      }

      // 2. Invoice Number
      const rawInvoiceNumber = (
        row["sub_order_num"] ||
        row["sub_order_no"] ||
        row["Invoice Number"] ||
        row["identifier"] ||
        ""
      ).trim();

      let invoiceNumber = rawInvoiceNumber;
      if (rawInvoiceNumber.length > 16) {
        invoiceNumber = rawInvoiceNumber.slice(-16);
      }

      // 3. Date
      const rawInvoiceDate =
        (txType === "Return"
          ? row["cancel_return_date"] || row["order_date"] || row["manifest_date"]
          : row["order_date"] || row["manifest_date"] || row["cancel_return_date"]) || "";

      const invoiceDate = transformDate(rawInvoiceDate.trim()) || rawInvoiceDate.trim();

      // 4. Buyer GSTIN & Category
      const rawBuyerGstin = (
        row["Customer GSTIN"] ||
        row["Buyer Gstin"] ||
        row["recipient_gstin"] ||
        ""
      ).trim();
      const buyerGstin =
        rawBuyerGstin && rawBuyerGstin.toUpperCase() !== context.supplierGstin?.toUpperCase()
          ? rawBuyerGstin
          : "";

      const isB2B = Boolean(buyerGstin);

      let invoiceType: InvoiceCategory;
      if (isB2B) {
        invoiceType = txType === "Return" ? "CDNR" : "B2B";
      } else {
        invoiceType = txType === "Return" ? "CDNCS" : "B2CS";
      }

      // 5. Place of Supply
      const rawPos = (
        row["end_customer_state_new"] ||
        row["end_customer_state"] ||
        row["End Customer State"] ||
        row["Customer State"] ||
        row["State"] ||
        ""
      ).trim();

      const pos = transformStateCode(rawPos) || rawPos;

      const taxableValue = round2(Math.abs(rawTaxableValNum));
      let totalTax = round2(Math.abs(rawTaxNum));

      const rawIgst = Math.abs(parseFloat(row["IGST Amount"] || row["IGST"] || "0"));
      const rawCgst = Math.abs(parseFloat(row["CGST Amount"] || row["CGST"] || "0"));
      const rawSgst = Math.abs(parseFloat(row["SGST Amount"] || row["SGST"] || "0"));
      const cessAmount = Math.abs(parseFloat(row["CESS Amount"] || row["Cess"] || "0"));

      if (!totalTax) {
        totalTax = round2(rawIgst + rawCgst + rawSgst + cessAmount);
      }

      const totalValue = round2(
        Math.abs(
          parseFloat(
            row["total_invoice_value"] || row["Total Amount"] || row["Invoice Amount"] || "0"
          )
        ) || taxableValue + totalTax
      );

      // 7. Rate
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

      const isInterState = context.supplierGstin
        ? context.supplierGstin.substring(0, 2) !== pos
        : true;

      let igstRate = 0;
      let cgstRate = 0;
      let sgstRate = 0;
      let igstAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;

      if (isInterState) {
        igstRate = gstRate;
        igstAmount = round2(taxableValue * (gstRate / 100));
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmount = round2(taxableValue * (gstRate / 200));
        sgstAmount = round2(taxableValue * (gstRate / 200));
      }

      // HSN
      const hsnCode = transformHsn(row["hsn_code"] || row["HSN Code"] || row["HSN"]);

      // ECO GSTIN resolution
      const eco = resolveEcoGstin({
        platformId: "meesho",
        supplierGstin: context.supplierGstin,
        userFallbackGstin: context.fallbackEcoGstin,
        rowGstin: row["eco_tcs_gstin"] || row["ECO GSTIN"],
      });

      // Quantity
      const quantity = parseInt(row["quantity"] || row["Qty"] || "1", 10) || 1;

      // Strictly validate Columns H, I, J, M as required fields for Meesho
      const rawGstRate = row["gst_rate"] ?? row["GST Rate"] ?? row["Tax Rate"];
      const rawTaxableVal =
        row["total_taxable_sale_value"] ?? row["Taxable Value"] ?? row["Taxable Amount"];
      const rawTaxAmount = row["tax_amount"] ?? row["Tax Amount"] ?? row["IGST Amount"];
      const rawState =
        row["end_customer_state_new"] ??
        row["end_customer_state"] ??
        row["End Customer State"] ??
        row["Customer State"] ??
        row["State"];

      if (rawGstRate === undefined || rawGstRate === null || String(rawGstRate).trim() === "") {
        errors.push("Missing GST Rate (Column H)");
      }
      if (
        rawTaxableVal === undefined ||
        rawTaxableVal === null ||
        String(rawTaxableVal).trim() === ""
      ) {
        errors.push("Missing Taxable Value (Column I)");
      }
      if (
        rawTaxAmount === undefined ||
        rawTaxAmount === null ||
        String(rawTaxAmount).trim() === ""
      ) {
        errors.push("Missing Tax Amount (Column J)");
      }
      if (rawState === undefined || rawState === null || String(rawState).trim() === "") {
        errors.push("Missing Place of Supply (Column M)");
      }

      if (errors.length > 0) {
        _errorRows++;
        continue;
      }
      _validRows++;

      const tx: NormalizedInvoiceRow = {
        id: crypto.randomUUID(),
        rowIndex: i + 1,
        sourcePlatformId: "meesho",
        sourcePlatformName: "Meesho",
        sourceFileName: context.fileName,
        sourceFileType: context.reportType,
        transactionType: txType,

        invoiceNumber,
        invoiceDate,
        invoiceType,

        buyerName: "Meesho B2C Customer",
        buyerGstin,
        placeOfSupply: pos,

        itemDescription: `Meesho Order ${invoiceNumber}`,
        hsnCode,
        uqc: "PCS",
        quantity,

        totalValue,
        taxableValue,

        igstRate,
        cgstRate,
        sgstRate,
        cessRate: 0,

        igstAmount,
        cgstAmount,
        sgstAmount,
        cessAmount: 0,

        ecoGstin: eco.ecoGstin,
        ecoName: eco.ecoName,

        errors,
        reviews: [],
      };

      transactions.push(tx);
    }

    return {
      sourceContext: context,
      transactions,
      unmappedColumns: Array.from(unmappedColumns),
      totalRows: rows.length,
      validRows: _validRows,
      errorRows: _errorRows,
    };
  }
}
