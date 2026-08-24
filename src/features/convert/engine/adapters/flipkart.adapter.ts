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
import { resolveEcoGstin } from "@/features/convert/config/eco-registry";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class FlipkartAdapter {
  static adapt(rows: Record<string, string>[], context: SourceContext): AdapterResult {
    const transactions: NormalizedInvoiceRow[] = [];
    const unmappedColumns = new Set<string>();
    let validRows = 0;
    let errorRows = 0;

    const sheetNameLower = (context.sheetName || "").toLowerCase();

    // Skip reference/summary/help sheets that do not contain individual transaction line items
    if (
      sheetNameLower.includes("help") ||
      sheetNameLower.includes("section 12") ||
      sheetNameLower.includes("section 13") ||
      sheetNameLower.includes("gstr-8") ||
      sheetNameLower.includes("section 3 in gstr-8")
    ) {
      return {
        sourceContext: context,
        transactions: [],
        unmappedColumns: [],
        totalRows: rows.length,
        validRows: 0,
        errorRows: 0,
      };
    }

    const isSection7B2 = sheetNameLower.includes("7(b)(2)") || sheetNameLower.includes("7b2");
    const isSection7A2 = sheetNameLower.includes("7(a)(2)") || sheetNameLower.includes("7a2");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];

      // Skip empty rows
      const hasAnyValue = Object.values(row).some((v) => String(v || "").trim() !== "");
      if (!hasAnyValue) continue;

      // 1. Transaction Type & Category
      let txType: TransactionType = "Sales";
      const rawTxType = (row["Transaction Type"] || row["Event Type"] || "").trim().toUpperCase();
      if (rawTxType === "RETURN" || rawTxType === "REFUND") {
        txType = "Return";
      } else if (rawTxType === "CANCELLED" || rawTxType === "CANCEL") {
        continue;
      }

      // 2. Place of Supply
      const rawPos = (
        row["Delivered State (PoS)"] ||
        row["Delivered State Code"] ||
        row["Customer State"] ||
        row["Delivery State"] ||
        row["State"] ||
        ""
      ).trim();

      const pos = transformStateCode(rawPos) || rawPos;

      // 3. Taxable & Tax Values
      const taxableValue = round2(
        parseFloat(
          row["Aggregate Taxable Value Rs."] ||
            row["Gross Taxable Value Rs."] ||
            row["Total Taxable Value Rs."] ||
            row["Taxable Value Rs."] ||
            row["Taxable Value"] ||
            row["Taxable Amount"] ||
            "0"
        )
      );

      // Skip zero taxable rows in summary section reports
      if (taxableValue === 0 && (isSection7B2 || isSection7A2)) {
        continue;
      }

      const igstRate = parseFloat(row["IGST %"] || row["IGST Rate"] || "0");
      const cgstRate = parseFloat(row["CGST %"] || row["CGST Rate"] || "0");
      const sgstRate = parseFloat(row["SGST/UT %"] || row["SGST Rate"] || "0");

      let igstAmount = round2(parseFloat(row["IGST Amount Rs."] || row["IGST"] || "0"));
      let cgstAmount = round2(parseFloat(row["CGST Amount Rs."] || row["CGST"] || "0"));
      let sgstAmount = round2(
        parseFloat(row["SGST /UT Amount Rs."] || row["SGST Amount"] || row["SGST"] || "0")
      );
      const cessAmount = round2(
        parseFloat(row["CESS Amount Rs."] || row["Cess Rs."] || row["CESS"] || "0")
      );

      let totalTax = round2(igstAmount + cgstAmount + sgstAmount + cessAmount);

      // Derive missing tax amounts from rates if available
      if (totalTax === 0 && (igstRate > 0 || cgstRate > 0 || sgstRate > 0)) {
        if (igstRate > 0) igstAmount = round2(taxableValue * (igstRate / 100));
        if (cgstRate > 0) cgstAmount = round2(taxableValue * (cgstRate / 100));
        if (sgstRate > 0) sgstAmount = round2(taxableValue * (sgstRate / 100));
        totalTax = round2(igstAmount + cgstAmount + sgstAmount + cessAmount);
      }

      const totalValue = round2(
        parseFloat(
          row["Total Value Rs."] || row["Invoice Amount Rs."] || row["Invoice Amount"] || "0"
        ) || taxableValue + totalTax
      );

      // 4. Identities & Dates
      const rawInvoiceNumber = (row["Invoice Number"] || row["sub_order_num"] || "").trim();

      const invoiceNumber =
        rawInvoiceNumber.length > 16 ? rawInvoiceNumber.slice(-16) : rawInvoiceNumber;

      const rawInvoiceDate = (row["Invoice Date"] || row["Order Date"] || "").trim();
      const invoiceDate = transformDate(rawInvoiceDate) || rawInvoiceDate;

      const buyerGstin = (row["Buyer Gstin"] || row["Customer GSTIN"] || "").trim();
      const isB2B = Boolean(buyerGstin);

      let invoiceType: InvoiceCategory = isB2B ? "B2B" : "B2CS";
      if (txType === "Return") {
        invoiceType = isB2B ? "CDNR" : "CDNCS";
      }

      const quantity = parseInt(row["Total Quantity in Nos."] || row["Quantity"] || "1", 10) || 1;

      // Validation
      if (!pos) {
        errors.push("Missing Place of Supply");
      }

      if (errors.length > 0) {
        errorRows++;
        continue;
      }
      // 6. ECO GSTIN Resolution
      const eco = resolveEcoGstin({
        platformId: "flipkart",
        supplierGstin: context.supplierGstin,
        userFallbackGstin: context.fallbackEcoGstin,
        rowGstin: row["TCS GSTIN"] || row["GSTIN of Flipkart.Com"] || row["ECO GSTIN"],
      });
      validRows++;

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

        buyerName: isB2B ? "Flipkart Registered Customer" : "Flipkart B2C Customer",
        buyerGstin,
        placeOfSupply: pos,

        itemDescription: "Flipkart Outward Supply",
        hsnCode: "441990",
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
        cessAmount,

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
      validRows,
      errorRows,
    };
  }
}
