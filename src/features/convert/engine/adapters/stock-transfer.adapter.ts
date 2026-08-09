import type { AdapterResult, SourceContext } from "./types";
import type { NormalizedInvoiceRow, TransactionType } from "@/features/convert/types/convert.types";
import {
  transformStateCode,
  transformDate,
  transformHsn,
} from "@/features/convert/engine/transformation/transformers";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Amazon MTR Stock Transfer Adapter
 *
 * Handles Amazon's inter-FC stock transfer report (MTR_STOCK_TRANSFER).
 *
 * Transaction types:
 *   FC_TRANSFER    → B2B supply between supplier and receiver GSTINs (different states = IGST)
 *   FC_REMOVAL     → B2B removal (also a supply; check supplier vs receiver states)
 *   FC_REMOVAL-Cancel → CANCELS a corresponding FC_REMOVAL; the two must be paired and
 *                       NEITHER should appear in the final GSTR-1 (net-zero effect).
 *
 * Cancellation pairing logic (FC_REMOVAL-Cancel):
 *   We use a two-pass approach:
 *   1. First pass: map every FC_REMOVAL by its `Order Id` (the stable identifier)
 *   2. Second pass: for each FC_REMOVAL-Cancel, remove the matching FC_REMOVAL from the output
 *   3. Any FC_REMOVAL-Cancel that has no matching FC_REMOVAL is still emitted as a negation
 *      (defensive: prevents overstating supplies when the original cancel arrives first)
 *
 * IGST vs CGST/SGST:
 *   Derived from actual Supplier GSTIN state prefix vs Receiver GSTIN state prefix.
 *   Falls back to comparing Ship From State vs Ship To State if GSTINs are not parseable.
 *   No hardcoded "always IGST" — inter-FC does not guarantee different states.
 */
export class StockTransferAdapter {
  static adapt(rows: Record<string, string>[], context: SourceContext): AdapterResult {
    const transactions: NormalizedInvoiceRow[] = [];
    const unmappedColumns = new Set<string>();
    let _validRows = 0;
    let _errorRows = 0;

    // ── Pass 1: Separate rows by transaction type ────────────────────────────
    const transferRows: Record<string, string>[] = [];
    const removalRows: Record<string, string>[] = [];
    const cancelRows: Record<string, string>[] = [];

    for (const row of rows) {
      const txType = (row["Transaction Type"] || "").trim().toUpperCase();
      if (txType === "FC_TRANSFER") {
        transferRows.push(row);
      } else if (txType === "FC_REMOVAL") {
        removalRows.push(row);
      } else if (txType === "FC_REMOVAL-CANCEL") {
        cancelRows.push(row);
      }
      // Any other types are silently ignored (Amazon may add new types in future)
    }

    // ── Pass 2: Pair FC_REMOVAL-Cancel with FC_REMOVAL ──────────────────────
    // Key: Order Id (stable across cancellation pairs)
    const cancelledOrderIds = new Set<string>();
    for (const cancel of cancelRows) {
      const orderId = (cancel["Order Id"] || cancel["Transaction Id"] || "").trim();
      if (orderId) cancelledOrderIds.add(orderId);
    }

    // FC_REMOVAL rows that have NOT been cancelled
    const uncancelledRemovals = removalRows.filter((row) => {
      const orderId = (row["Order Id"] || row["Transaction Id"] || "").trim();
      return !cancelledOrderIds.has(orderId);
    });

    // FC_REMOVAL-Cancel rows that have NO matching FC_REMOVAL (emit as negative/reversal)
    const cancelledRemovalOrderIds = new Set(
      removalRows.map((r) => (r["Order Id"] || r["Transaction Id"] || "").trim())
    );
    const orphanCancels = cancelRows.filter((row) => {
      const orderId = (row["Order Id"] || row["Transaction Id"] || "").trim();
      return !cancelledRemovalOrderIds.has(orderId);
    });

    // ── Pass 3: Process all active rows ─────────────────────────────────────
    const activeRows: Array<{ row: Record<string, string>; isOrphanCancel: boolean }> = [
      ...transferRows.map((r) => ({ row: r, isOrphanCancel: false })),
      ...uncancelledRemovals.map((r) => ({ row: r, isOrphanCancel: false })),
      ...orphanCancels.map((r) => ({ row: r, isOrphanCancel: true })),
    ];

    for (let i = 0; i < activeRows.length; i++) {
      const { row, isOrphanCancel } = activeRows[i]!;
      const errors: string[] = [];

      // ── Identities ──────────────────────────────────────────────────────
      const invoiceNumber = (row["Invoice Number"] || "").trim();
      const rawDate = (row["Invoice Date"] || "").trim();
      const invoiceDate = transformDate(rawDate) || rawDate;

      const supplierGstin = (row["Gstin Of Supplier"] || "").trim();
      const receiverGstin = (row["Gstin Of Receiver"] || "").trim();

      // ── Place of Supply: derived from receiver GSTIN state prefix ────────
      // Per GST rules: POS for stock transfer = destination state
      const receiverStateFromGstin = receiverGstin.substring(0, 2);
      const supplierStateFromGstin = supplierGstin.substring(0, 2);

      // Fallback: Ship To State / Ship From State
      const rawShipToState = (row["Ship To State"] || "").trim();
      const rawShipFromState = (row["Ship From State"] || "").trim();
      const shipToCode = transformStateCode(rawShipToState) || rawShipToState;
      const shipFromCode = transformStateCode(rawShipFromState) || rawShipFromState;

      const pos = receiverStateFromGstin || shipToCode || "99";

      const supplierStateCode = supplierStateFromGstin || shipFromCode || "";

      // ── Inter-state determination ────────────────────────────────────────
      // Do NOT hardcode IGST. Compare actual supplier state vs receiver state.
      const isInterState = supplierStateCode !== "" && pos !== "" && supplierStateCode !== pos;

      // ── Tax amounts ──────────────────────────────────────────────────────
      const taxableValue = round2(parseFloat(row["Taxable Value"] || "0") || 0);
      const rawIgstRate = parseFloat(row["Igst Rate"] || "0");
      const rawCgstRate = parseFloat(row["Cgst Rate"] || "0");
      const rawSgstRate = parseFloat(row["Sgst Rate"] || "0");
      const rawUtgstRate = parseFloat(row["Utgst Rate"] || "0");

      const rawIgstAmount = parseFloat(row["Igst Amount"] || "0");
      const rawCgstAmount = parseFloat(row["Cgst Amount"] || "0");
      const rawSgstAmount = parseFloat(row["Sgst Amount"] || "0");
      const rawUtgstAmount = parseFloat(row["Utgst Amount"] || "0");
      const cessAmount = round2(parseFloat(row["Compensatory Cess Amount"] || "0"));
      const cessRate = parseFloat(row["Compensatory Cess Rate"] || "0");

      // Pick effective CGST/SGST: SGST or UTGST (whichever is present)
      const effectiveCgstRate = rawCgstRate || 0;
      const effectiveSgstRate = rawSgstRate || rawUtgstRate || 0;
      const effectiveCgstAmount = round2(rawCgstAmount || 0);
      const effectiveSgstAmount = round2(rawSgstAmount || rawUtgstAmount || 0);

      let igstRate = 0;
      let cgstRate = 0;
      let sgstRate = 0;
      let igstAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;

      if (isInterState) {
        // Use actual IGST columns from the file (they are populated for inter-state)
        igstRate = rawIgstRate * (rawIgstRate < 1 ? 100 : 1); // handle 0.05 vs 5
        igstAmount = round2(rawIgstAmount);
      } else {
        // Intra-state: use CGST + SGST/UTGST columns
        cgstRate = effectiveCgstRate * (effectiveCgstRate < 1 ? 100 : 1);
        sgstRate = effectiveSgstRate * (effectiveSgstRate < 1 ? 100 : 1);
        cgstAmount = effectiveCgstAmount;
        sgstAmount = effectiveSgstAmount;
      }

      // Normalize rate values: Amazon stores 0.05 meaning 5%; convert to percentage
      const normalizeRate = (r: number) => (r > 0 && r < 1 ? round2(r * 100) : r);
      igstRate = normalizeRate(igstRate);
      cgstRate = normalizeRate(cgstRate);
      sgstRate = normalizeRate(sgstRate);

      const totalValue = round2(
        parseFloat(row["Invoice Value"] || "0") ||
          taxableValue + igstAmount + cgstAmount + sgstAmount + cessAmount
      );

      const hsnCode = transformHsn(row["Hsn Code"] || row["HSN Code"]);
      const txTypeFinal: TransactionType = isOrphanCancel ? "Return" : "Sales";

      // ── Validation ───────────────────────────────────────────────────────
      if (!invoiceNumber) errors.push("Missing Invoice Number");
      if (!invoiceDate) errors.push("Missing Invoice Date");
      if (!pos || pos === "99") errors.push("Missing Place of Supply");
      if (!receiverGstin) errors.push("Missing Receiver GSTIN");

      const tx: NormalizedInvoiceRow = {
        id: crypto.randomUUID(),
        rowIndex: i + 1,
        sourcePlatformId: "amazon_stock_transfer",
        sourcePlatformName: "Amazon FC Transfer",
        sourceFileName: context.fileName,
        sourceFileType: context.reportType,
        transactionType: txTypeFinal,

        invoiceNumber,
        invoiceDate,
        invoiceType: "B2B",

        buyerName: "Amazon FC Transfer",
        buyerGstin: receiverGstin,
        placeOfSupply: pos,

        itemDescription: `FC Transfer — ${row["Ship From Fc"] || ""} → ${row["Ship To Fc"] || ""}`,
        hsnCode,
        uqc: "NOS",
        quantity: parseFloat(row["Quantity"] || "1") || 1,

        taxableValue: isOrphanCancel ? -Math.abs(taxableValue) : taxableValue,
        igstAmount: isOrphanCancel ? -Math.abs(igstAmount) : igstAmount,
        cgstAmount: isOrphanCancel ? -Math.abs(cgstAmount) : cgstAmount,
        sgstAmount: isOrphanCancel ? -Math.abs(sgstAmount) : sgstAmount,
        cessAmount,
        totalValue: isOrphanCancel ? -Math.abs(totalValue) : totalValue,

        igstRate,
        cgstRate,
        sgstRate,
        cessRate: normalizeRate(cessRate),

        ecoGstin: "",
        ecoName: "Amazon",

        originalInvoiceNumber: undefined,
        errors,
      };

      if (errors.length > 0) _errorRows++;
      else _validRows++;

      transactions.push(tx);
    }

    // Final counts
    let finalValidRows = 0;
    let finalErrorRows = 0;
    for (const tx of transactions) {
      if (tx.errors.length > 0) finalErrorRows++;
      else finalValidRows++;
    }

    return {
      sourceContext: context,
      transactions,
      unmappedColumns: [...unmappedColumns],
      totalRows: transactions.length,
      validRows: finalValidRows,
      errorRows: finalErrorRows,
    };
  }
}
