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

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class AmazonAdapter {
  static adapt(rows: Record<string, string>[], context: SourceContext): AdapterResult {
    const transactions: NormalizedInvoiceRow[] = [];
    const unmappedColumns = new Set<string>();
    let _validRows = 0;
    let _errorRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];

      // 1. Transaction Type
      const rawTxType = (row["Transaction Type"] || row["Transaction type"] || "")
        .trim()
        .toUpperCase();
      let txType: TransactionType = "Sales";
      if (rawTxType === "REFUND" || rawTxType === "RETURN") {
        txType = "Return";
      } else if (rawTxType === "CANCEL") {
        continue; // Skip cancelled order entries
      }

      // 2. Identities
      const invoiceNumber = (
        row["Credit Note No"] ||
        row["Invoice Number"] ||
        row["Invoice number"] ||
        row["Order Id"] ||
        ""
      ).trim();

      const rawInvoiceDate = (
        row["Credit Note Date"] ||
        row["Invoice Date"] ||
        row["Invoice date"] ||
        row["Order Date"] ||
        ""
      ).trim();
      const invoiceDate = transformDate(rawInvoiceDate) || rawInvoiceDate;

      const buyerGstin = (row["Buyer Gstin"] || row["Customer Bill To Gstid"] || "").trim();
      const rawPos = (
        row["Ship To State"] ||
        row["Customer Bill To State"] ||
        row["Bill To State"] ||
        ""
      ).trim();
      const pos = transformStateCode(rawPos) || rawPos;

      const isB2B = Boolean(buyerGstin);

      // Determine Invoice Category
      let invoiceType: InvoiceCategory = isB2B ? "B2B" : "B2CS";
      if (txType === "Return") {
        invoiceType = "CDNR";
      }

      // 3. Taxable & Tax Values
      const principalBasis = parseFloat(row["Principal Amount Basis"] || "0");
      const shippingBasis = parseFloat(row["Shipping Amount Basis"] || "0");
      const giftWrapBasis = parseFloat(row["Gift Wrap Amount Basis"] || "0");

      // Taxable value = PRE-PROMO basis (Principal + Shipping + GiftWrap).
      // Amazon collects GST on the full pre-discount selling price. The promo discount
      // is a seller-funded marketing expense — it does NOT reduce the GST-liable amount.
      // Using Tax Exclusive Gross (which is post-promo) causes a tax mismatch because
      // tax columns in the MTR always reflect the pre-promo basis.
      let taxableValue: number;
      if (principalBasis || shippingBasis) {
        taxableValue = principalBasis + shippingBasis + giftWrapBasis;
      } else {
        // Older report format: Tax Exclusive Gross is all we have
        taxableValue = parseFloat(row["Tax Exclusive Gross"] || "0");
      }
      taxableValue = round2(taxableValue);

      // Stated Tax Components
      // NOTE: Item Promo Tax is a discount tax adjustment — do NOT add to IGST.
      // It is already factored into Total Tax Amount and Tax Exclusive Gross.
      const rawIgstTax =
        parseFloat(row["Igst Tax"] || row["IGST Tax"] || "0") +
        parseFloat(row["Shipping Igst Tax"] || "0");
      const rawCgstTax =
        parseFloat(row["Cgst Tax"] || row["CGST Tax"] || "0") +
        parseFloat(row["Shipping Cgst Tax"] || "0");
      const rawSgstTax =
        parseFloat(row["Sgst Tax"] || row["SGST Tax"] || "0") +
        parseFloat(row["Shipping Sgst Tax"] || "0");
      const cessAmount = parseFloat(row["Cess Tax"] || "0");

      // Component sum is the most reliable figure — it is always row-specific.
      // "Total Tax Amount" can encode the original order tax on return rows (misleading).
      let totalTax = rawIgstTax + rawCgstTax + rawSgstTax + cessAmount;
      if (totalTax === 0 && row["Total Tax Amount"]) {
        totalTax = parseFloat(row["Total Tax Amount"] || "0");
      }
      totalTax = round2(totalTax);

      const totalValue = round2(
        parseFloat(row["Invoice Amount"] || "0") || taxableValue + totalTax
      );

      // 4. Rates
      let rawIgstRate = parseFloat(row["Igst Rate"] || "0");
      let rawCgstRate = parseFloat(row["Cgst Rate"] || "0");
      let rawSgstRate = parseFloat(row["Sgst Rate"] || "0");

      // Convert Amazon decimal rates (0.05 -> 5, 0.025 -> 2.5)
      if (rawIgstRate > 0 && rawIgstRate <= 1) rawIgstRate *= 100;
      if (rawCgstRate > 0 && rawCgstRate <= 1) rawCgstRate *= 100;
      if (rawSgstRate > 0 && rawSgstRate <= 1) rawSgstRate *= 100;

      let gstRate = rawIgstRate || rawCgstRate + rawSgstRate;
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

      // Check Inter-State vs Intra-State.
      // Priority: explicit rates from the file (most reliable) → tax components → fallback.
      const isInterState =
        rawIgstRate > 0 || rawCgstRate > 0
          ? rawIgstRate > 0 // File stated a rate — trust it
          : Math.abs(rawIgstTax) > 0 // No rate stated — use tax component presence
            ? true
            : Math.abs(rawCgstTax) > 0 || Math.abs(rawSgstTax) > 0
              ? false // CGST/SGST present → intra-state
              : true; // No tax components at all → default to inter-state

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
        originalInvoiceNumber = row["Invoice Number"] || row["Order Id"] || undefined;
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
        sourcePlatformId: "amazon",
        sourcePlatformName: "Amazon Seller MTR",
        sourceFileName: context.fileName,
        sourceFileType: context.reportType,
        transactionType: txType,

        invoiceNumber,
        invoiceDate,
        invoiceType,

        buyerName: row["Buyer Name"] || "Amazon Customer",
        buyerGstin,
        placeOfSupply: pos,

        itemDescription: row["Item Description"] || "",
        hsnCode: transformHsn(row["Hsn/sac"] || row["HSN/SAC"]),
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

        ecoGstin: "29XXXXXAMAZON",
        ecoName: "Amazon",

        originalInvoiceNumber,
        errors,
      };

      if (errors.length > 0) {
        _errorRows++;
      } else {
        _validRows++;
      }

      transactions.push(tx);
    }

    // POST-PROCESSING: Consolidate multi-item invoices.
    // Amazon MTR exports one row per line item. GSTR-1 requires one row per invoice.
    // Merge rows sharing the same invoiceNumber + transactionType.
    const invoiceMap = new Map<string, NormalizedInvoiceRow>();
    for (const tx of transactions) {
      const key = `${tx.transactionType}::${tx.invoiceNumber}`;
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
        existing.quantity = (existing.quantity || 1) + (tx.quantity || 1);
        // Merge item descriptions
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
