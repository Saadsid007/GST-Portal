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
  FALLBACK_HSN,
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

    // ── Step 5: Build ASIN → HSN lookup from rows that DO have HSN populated ──
    // Amazon sometimes leaves the HSN/SAC column blank for certain ASINs.
    // We do a quick pre-scan of ALL rows (before GSTIN filter) to collect any
    // ASIN that appears with a valid HSN, then use that mapping to fill blanks.
    const asinHsnMap = new Map<string, string>();
    for (const r of rows) {
      const asin = String(r["ASIN"] || "").trim();
      const rawHsn = String(r["Hsn/sac"] || r["HSN/SAC"] || "").trim();
      if (asin && rawHsn && /\d{4,8}/.test(rawHsn)) {
        const digits = rawHsn.replace(/\D/g, "");
        if (digits) asinHsnMap.set(asin, digits);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];

      // ── Step 1: GSTIN-level strict row filter ──────────────────────────────
      // Amazon MTR files contain rows for ALL of a merchant's GSTINs mixed
      // together (06-Haryana, 09-UP, 27-Maharashtra, 29-Karnataka, etc.).
      // We MUST only process rows belonging to the GSTIN we're generating
      // GSTR-1 for, otherwise data from other states bleeds into this return.
      const rowSellerGstin = (
        row["Seller Gstin"] ||
        row["Seller Gstid"] ||
        row["Supplier Gstin"] ||
        row["Customer Bill From Gstid"] ||
        ""
      )
        .trim()
        .toUpperCase();

      if (
        context.supplierGstin &&
        rowSellerGstin &&
        rowSellerGstin !== context.supplierGstin.toUpperCase()
      ) {
        // Row belongs to a different GSTIN — skip it entirely.
        continue;
      }

      // ── Step 1 end ─────────────────────────────────────────────────────────

      // 2. Transaction Type
      const rawTxType = (row["Transaction Type"] || row["Transaction type"] || "")
        .trim()
        .toUpperCase();
      let txType: TransactionType = "Sales";
      if (rawTxType === "REFUND" || rawTxType === "RETURN") {
        txType = "Return";
      } else if (rawTxType === "CANCEL") {
        // Cancelled orders never become invoices — exclude completely.
        continue;
      } else if (
        rawTxType === "FREEREPLACEMNT" ||
        rawTxType === "FREE_REPLACEMENT" ||
        rawTxType === "FREEREPLACEMENT"
      ) {
        // FreeReplacement: Amazon ships a free unit to the customer.
        // If the value is zero, there is no supply to report.
        // If it carries a taxable value (rare), treat it as a normal B2C sale.
        const freeVal = parseFloat(
          row["Tax Exclusive Gross"] || row["Principal Amount Basis"] || "0"
        );
        if (Math.abs(freeVal) === 0) continue; // zero-value → skip
        // non-zero falls through as Sales
      }

      // 2. Identities
      const rawInvoiceNumber = String(
        row["Credit Note No"] ||
        row["Invoice Number"] ||
        row["Invoice number"] ||
        row["Order Id"] ||
        ""
      ).trim();
      // Amazon Order IDs (like 407-9328146-3126765) are 19 chars and exceed GST's 16-char limit.
      // Truncate to 16 characters; the row will carry a review note to alert the user.
      const invoiceNumberTruncated = rawInvoiceNumber.length > 16;
      const invoiceNumber = rawInvoiceNumber.substring(0, 16);

      const rawInvoiceDate = String(
        row["Credit Note Date"] ||
        row["Invoice Date"] ||
        row["Invoice date"] ||
        row["Order Date"] ||
        ""
      ).trim();
      const invoiceDate = transformDate(rawInvoiceDate) || rawInvoiceDate;

      const buyerGstin = String(row["Buyer Gstin"] || row["Customer Bill To Gstid"] || "").trim();
      const rawPos = String(
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
        invoiceType = isB2B ? "CDNR" : "CDNCS";
      }

      // 3. Taxable & Tax Values
      const principalBasis = parseFloat(row["Principal Amount Basis"] || "0");
      const shippingBasis = parseFloat(row["Shipping Amount Basis"] || "0");
      const giftWrapBasis = parseFloat(row["Gift Wrap Amount Basis"] || "0");

      const itemPromo = Math.abs(parseFloat(row["Item Promo Discount"] || "0"));
      const shippingPromo = Math.abs(parseFloat(row["Shipping Promo Discount"] || "0"));
      const giftWrapPromo = Math.abs(parseFloat(row["Gift Wrap Promo Discount"] || "0"));

      // Taxable value = Tax Exclusive Gross when present in Amazon MTR (pre-calculated net base).
      let taxableValue: number;
      if (row["Tax Exclusive Gross"] !== undefined && row["Tax Exclusive Gross"] !== "") {
        taxableValue = parseFloat(row["Tax Exclusive Gross"]);
      } else if (principalBasis || shippingBasis) {
        taxableValue =
          principalBasis +
          shippingBasis +
          giftWrapBasis -
          itemPromo -
          shippingPromo -
          giftWrapPromo;
      } else {
        taxableValue = 0;
      }
      taxableValue = round2(taxableValue);

      // Stated Tax Components (including Promo Tax adjustments which offset shipping/item tax)
      const itemPromoTax = parseFloat(row["Item Promo Tax"] || "0");
      const shippingPromoTax = parseFloat(row["Shipping Promo Tax"] || "0");
      const giftWrapPromoTax = parseFloat(row["Gift Wrap Promo Tax"] || "0");
      const genericPromoTax = itemPromoTax + shippingPromoTax + giftWrapPromoTax;

      let rawIgstTax =
        parseFloat(row["Igst Tax"] || row["IGST Tax"] || "0") +
        parseFloat(row["Shipping Igst Tax"] || "0") +
        parseFloat(row["Gift Wrap Igst Tax"] || "0") +
        parseFloat(row["Item Promo Igst Tax"] || "0") +
        parseFloat(row["Shipping Promo Igst Tax"] || "0") +
        parseFloat(row["Gift Wrap Promo Igst Tax"] || "0");

      let rawCgstTax =
        parseFloat(row["Cgst Tax"] || row["CGST Tax"] || "0") +
        parseFloat(row["Shipping Cgst Tax"] || "0") +
        parseFloat(row["Gift Wrap Cgst Tax"] || "0") +
        parseFloat(row["Item Promo Cgst Tax"] || "0") +
        parseFloat(row["Shipping Promo Cgst Tax"] || "0") +
        parseFloat(row["Gift Wrap Promo Cgst Tax"] || "0");

      let rawSgstTax =
        parseFloat(row["Sgst Tax"] || row["SGST Tax"] || "0") +
        parseFloat(row["Shipping Sgst Tax"] || "0") +
        parseFloat(row["Gift Wrap Sgst Tax"] || "0") +
        parseFloat(row["Item Promo Sgst Tax"] || "0") +
        parseFloat(row["Shipping Promo Sgst Tax"] || "0") +
        parseFloat(row["Gift Wrap Promo Sgst Tax"] || "0");

      if (genericPromoTax !== 0) {
        if (rawIgstTax !== 0) {
          rawIgstTax += genericPromoTax;
        } else if (rawCgstTax !== 0 || rawSgstTax !== 0) {
          rawCgstTax += genericPromoTax / 2;
          rawSgstTax += genericPromoTax / 2;
        }
      }

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
      // IMPORTANT: Always derive from actual supplier state vs POS.
      // Do NOT use raw rate columns for this determination — Amazon MTR sometimes
      // has IGST rate populated even for intra-state supplies (same state).
      // The source-of-truth is: supplierGstin[0:2] vs placeOfSupply.
      //
      // If we don't have the supplier GSTIN here (context provides it), fall back
      // to the raw rate columns as a secondary signal.
      // supplierGstinInRow was already read above for the GSTIN filter (Step 1).
      // Reuse it here for inter-state detection.
      const rawSupplierStateInRow = (
        row["Ship From State"] ||
        row["Ship-From State"] ||
        row["Supplier State"] ||
        row["Seller State"] ||
        ""
      ).trim();

      const supplierStateInAdapter = context.supplierGstin
        ? context.supplierGstin.substring(0, 2)
        : rowSellerGstin
          ? rowSellerGstin.substring(0, 2)
          : transformStateCode(rawSupplierStateInRow) || "";

      const isInterState =
        supplierStateInAdapter && pos
          ? supplierStateInAdapter !== pos // Primary: actual state comparison
          : rawIgstRate > 0 || rawCgstRate > 0
            ? rawIgstRate > 0 // Secondary: rate column presence
            : Math.abs(rawIgstTax) > 0
              ? true
              : Math.abs(rawCgstTax) > 0 || Math.abs(rawSgstTax) > 0
                ? false
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

      const cessRate = 0;

      // Returns mapping
      let originalInvoiceNumber = undefined;
      if (txType === "Return") {
        originalInvoiceNumber = row["Invoice Number"] || row["Order Id"] || undefined;
      }

      // Reviews (non-blocking flags)
      const rowReviews: string[] = [];
      if (invoiceNumberTruncated) {
        rowReviews.push(
          `Invoice number truncated from ${rawInvoiceNumber.length} to 16 chars (was: "${rawInvoiceNumber}")`
        );
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
        hsnCode: (() => {
          // Step 5: Use ASIN→HSN map to fill blank HSN before falling back to generic
          const rawHsn = String(row["Hsn/sac"] || row["HSN/SAC"] || "");
          const asin = String(row["ASIN"] || "").trim();
          if (rawHsn.trim()) return transformHsn(rawHsn); // has its own HSN
          if (asin && asinHsnMap.has(asin)) return asinHsnMap.get(asin)!; // filled from map
          // No HSN known — flag as review, use generic fallback
          rowReviews.push(
            `HSN/SAC missing for ASIN ${asin || "unknown"} — using fallback code ${FALLBACK_HSN}. Please verify.`
          );
          return FALLBACK_HSN;
        })(),
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

        ecoGstin:
          context.fallbackEcoGstin ??
          (context.supplierGstin ? `${context.supplierGstin.slice(0, 2)}AARCM9332R1CM` : "09AARCM9332R1CM"),
        ecoName: "Amazon",

        originalInvoiceNumber,
        errors,
        reviews: rowReviews.length > 0 ? rowReviews : undefined,
      };

      if (errors.length > 0) {
        _errorRows++;
      } else {
        _validRows++;
      }

      transactions.push(tx);
    }

    // POST-PROCESSING: Consolidate multi-item invoices.
    // Amazon MTR exports one row per line item. GSTR-1 requires line items for the same invoice
    // to be grouped by HSN code and tax rate.
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
