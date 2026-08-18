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
  FALLBACK_BUYER_NAME,
  FALLBACK_HSN,
} from "@/features/convert/engine/transformation/transformers";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function getVal(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
    // Also try case-insensitive lookup
    const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [rKey, rVal] of Object.entries(row)) {
      if (rKey.toLowerCase().replace(/[^a-z0-9]/g, "") === lowerK) {
        if (rVal !== undefined && rVal !== null && String(rVal).trim() !== "") {
          return String(rVal).trim();
        }
      }
    }
  }
  return "";
}

function parseNum(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export class OfflineInvoicesAdapter {
  static adapt(rows: Record<string, string>[], context: SourceContext): AdapterResult {
    const transactions: NormalizedInvoiceRow[] = [];
    const unmappedColumns = new Set<string>();
    let validRows = 0;
    let errorRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];

      // 1. Invoice Number
      const invoiceNumber = getVal(
        row,
        "Invoice Number",
        "Invoice No",
        "Invoice #",
        "Bill No",
        "Inv No",
        "Invoice_Number",
        "Original Invoice Number"
      );

      if (!invoiceNumber) {
        // Skip purely empty spacer rows
        continue;
      }

      // 2. Invoice Date
      const rawDate = getVal(
        row,
        "Invoice Date",
        "Invoice date",
        "Date",
        "Bill Date",
        "Invoice_Date"
      );
      const invoiceDate = transformDate(rawDate) || rawDate;

      // 3. Buyer & GSTIN
      const buyerGstin = getVal(
        row,
        "Buyer GSTIN",
        "GSTIN/UIN of Recipient",
        "Party GSTIN",
        "Customer GSTIN",
        "Recipient GSTIN",
        "Buyer_GSTIN",
        "GSTIN"
      ).toUpperCase();

      const buyerName =
        getVal(
          row,
          "Buyer Name",
          "Receiver Name",
          "Customer Name",
          "Party Name",
          "Buyer_Name",
          "Buyer"
        ) || (buyerGstin ? "Registered Buyer" : FALLBACK_BUYER_NAME);

      // 4. Classification (B2B vs B2CS vs B2CL)
      const rawType = getVal(
        row,
        "Type",
        "Classification",
        "Invoice Type",
        "Category"
      ).toUpperCase();

      let invoiceType: InvoiceCategory = "B2CS";
      if (buyerGstin && buyerGstin.length === 15 && buyerGstin !== context.supplierGstin) {
        invoiceType = "B2B";
      } else if (rawType.includes("B2B")) {
        invoiceType = "B2B";
      } else if (rawType.includes("B2CL")) {
        invoiceType = "B2CL";
      } else if (rawType.includes("CDNR")) {
        invoiceType = "CDNR";
      }

      // 5. Place of Supply (POS)
      const rawPos = getVal(
        row,
        "Place of Supply",
        "Place Of Supply",
        "POS",
        "State",
        "State Code"
      );
      let pos = transformStateCode(rawPos, buyerGstin);
      if (!pos && context.supplierGstin) {
        pos = context.supplierGstin.slice(0, 2);
      }
      if (!pos) pos = "09";

      const supplierState = context.supplierGstin ? context.supplierGstin.slice(0, 2) : "09";
      const isInterState = pos !== supplierState;

      // 6. HSN & Line Description
      const rawHsn = getVal(
        row,
        "HSN/SAC Code",
        "HSN/SAC",
        "HSN Code",
        "HSN",
        "SAC",
        "SAC Code"
      );
      const hsnCode = transformHsn(rawHsn) || (rawHsn ? rawHsn.replace(/\D/g, "") : FALLBACK_HSN);

      const itemDescription =
        getVal(
          row,
          "Item Description",
          "Description",
          "Product Name",
          "Item Name",
          "Goods Description"
        ) || `Goods/Services supplied under HSN ${hsnCode}`;

      const uqc = getVal(row, "UQC", "Unit", "Quantity Unit") || (hsnCode.startsWith("99") ? "OTH" : "PCS");
      const quantity = parseNum(getVal(row, "Quantity", "Qty", "Total Quantity")) || 1;

      // 7. Rates & Financials
      const gstRate = parseNum(
        getVal(row, "GST Rate (%)", "Rate", "Rate (%)", "GST Rate", "Tax Rate (%)", "Tax Rate")
      ) || 5;

      const taxableValue = round2(
        parseNum(
          getVal(row, "Taxable Value (Rs)", "Taxable Value", "Taxable Amount", "Taxable", "Net Amount")
        )
      );

      let igstAmount = round2(parseNum(getVal(row, "IGST (Rs)", "IGST Amount", "IGST", "Integrated Tax Amount")));
      let cgstAmount = round2(parseNum(getVal(row, "CGST (Rs)", "CGST Amount", "CGST", "Central Tax Amount")));
      let sgstAmount = round2(parseNum(getVal(row, "SGST (Rs)", "SGST Amount", "SGST", "State/UT Tax Amount")));
      const cessAmount = round2(parseNum(getVal(row, "Cess (Rs)", "Cess Amount", "Cess")));

      const totalTax = round2(taxableValue * (gstRate / 100));

      if (igstAmount === 0 && cgstAmount === 0 && sgstAmount === 0 && taxableValue > 0) {
        if (isInterState) {
          igstAmount = totalTax;
        } else {
          cgstAmount = round2(totalTax / 2);
          sgstAmount = round2(totalTax / 2);
        }
      }

      let totalValue = round2(
        parseNum(
          getVal(
            row,
            "Total Amount (Rs)",
            "Total Amount",
            "Total Invoice Value (Rs)",
            "Total Invoice Value",
            "Invoice Value",
            "Total Value",
            "Gross Amount"
          )
        )
      );

      if (totalValue === 0 && taxableValue > 0) {
        totalValue = round2(taxableValue + igstAmount + cgstAmount + sgstAmount + cessAmount);
      }

      // 8. Transaction Type
      const rawTxType = getVal(row, "Transaction Type", "Doc Type", "Document Type");
      const transactionType: TransactionType =
        rawTxType.toLowerCase().includes("credit") || rawTxType.toLowerCase().includes("return") || taxableValue < 0
          ? "Return"
          : "Sales";

      const tx: NormalizedInvoiceRow = {
        id: `offline-${context.fileId}-${i + 1}`,
        rowIndex: i + 1,
        sourcePlatformId: "offline",
        sourcePlatformName: "Offline & Direct Invoices",
        sourceFileName: context.fileName,
        sourceFileType: context.reportType || "offline_invoices",
        invoiceNumber,
        invoiceDate,
        buyerName,
        buyerGstin,
        placeOfSupply: pos,
        invoiceType,
        transactionType,
        hsnCode,
        itemDescription,
        uqc,
        quantity,
        taxableValue,
        igstRate: isInterState ? gstRate : 0,
        cgstRate: isInterState ? 0 : gstRate / 2,
        sgstRate: isInterState ? 0 : gstRate / 2,
        cessRate: 0,
        igstAmount,
        cgstAmount,
        sgstAmount,
        cessAmount,
        totalValue,
        errors,
        reviews: [],
      };

      transactions.push(tx);
    }

    // POST-PROCESSING: Consolidate multi-item rows belonging to the same invoice, HSN & rate
    // In GSTR-1, an invoice is reported with 1 consolidated row per (HSN, Rate) combination.
    const invoiceMap = new Map<string, NormalizedInvoiceRow>();
    for (const tx of transactions) {
      const rate = tx.igstRate > 0 ? tx.igstRate : tx.cgstRate + tx.sgstRate;
      const key = `${tx.transactionType}::${tx.invoiceNumber}::${tx.hsnCode}::${rate}`;
      const existing = invoiceMap.get(key);
      if (!existing) {
        invoiceMap.set(key, tx);
      } else {
        // Sum numeric fields
        existing.taxableValue = round2(existing.taxableValue + tx.taxableValue);
        existing.igstAmount = round2(existing.igstAmount + tx.igstAmount);
        existing.cgstAmount = round2(existing.cgstAmount + tx.cgstAmount);
        existing.sgstAmount = round2(existing.sgstAmount + tx.sgstAmount);
        existing.cessAmount = round2(existing.cessAmount + tx.cessAmount);
        existing.totalValue = round2(existing.totalValue + tx.totalValue);
        existing.quantity = round2((existing.quantity || 1) + (tx.quantity || 1));
        if (tx.itemDescription && existing.itemDescription !== tx.itemDescription) {
          existing.itemDescription = `${existing.itemDescription}; ${tx.itemDescription}`;
        }
      }
    }

    const consolidated = Array.from(invoiceMap.values());
    let finalValidRows = 0;
    let finalErrorRows = 0;
    for (const tx of consolidated) {
      if (tx.errors.length > 0) finalErrorRows++;
      else finalValidRows++;
    }

    return {
      sourceContext: context,
      transactions: consolidated,
      unmappedColumns: Array.from(unmappedColumns),
      totalRows: rows.length,
      validRows: finalValidRows,
      errorRows: finalErrorRows,
    };
  }
}
