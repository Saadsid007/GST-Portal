import type {
  NormalizedInvoiceRow,
  InvoiceCategory,
  TransactionType,
} from "@/features/convert/types/convert.types";
import {
  transformDate,
  transformNumber,
  transformTaxRate,
  transformGstin,
  transformInvoiceNumber,
  transformStateCode,
  transformHsn,
  transformUqc,
  FALLBACK_BUYER_NAME,
} from "./transformers";

/** GST slabs notified under the Act. Anything outside these is a data problem, not a rate. */
const GST_SLABS = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Recovers the rate for files that ship tax amounts but no rate column. Only a value that
 * lands on a real slab is trusted — an arbitrary percentage means the two columns disagree,
 * and inventing a rate from that would bake the discrepancy into the return.
 */
function deriveRateFromAmounts(taxableValue: number, taxAmount: number): number | null {
  if (taxableValue === 0 || taxAmount === 0) return null;
  const pct = Math.abs((taxAmount / taxableValue) * 100);
  const slab = GST_SLABS.find((s) => Math.abs(s - pct) <= 0.1);
  return slab && slab > 0 ? slab : null;
}

export interface MappedRawRow {
  invoiceNumber?: unknown;
  invoiceDate?: unknown;
  buyerName?: unknown;
  buyerGstin?: unknown;
  placeOfSupply?: unknown;
  hsnCode?: unknown;
  itemDescription?: unknown;
  uqc?: unknown;
  quantity?: unknown;
  taxableValue?: unknown;
  cgstRate?: unknown;
  sgstRate?: unknown;
  igstRate?: unknown;
  cessRate?: unknown;
  cgstAmount?: unknown;
  sgstAmount?: unknown;
  igstAmount?: unknown;
  cessAmount?: unknown;
  totalValue?: unknown;
  originalInvoiceNumber?: unknown;
  originalInvoiceDate?: unknown;
  ecoGstin?: unknown;
  ecoName?: unknown;
  transactionType?: unknown;
}

export interface TransformContext {
  platformId: string;
  platformName: string;
  fileName: string;
  fileTypeId?: string;
  supplierGstin?: string;
  /**
   * The operator GSTIN configured for this platform, used when the export has no such column.
   *
   * Amazon's MTR carries no operator GSTIN at all, so without this Table 14 could never be
   * generated for it no matter how clean the upload was.
   */
  fallbackEcoGstin?: string;
}

/**
 * Transformation Engine — Orchestrates transforming mapped raw records into clean NormalizedInvoiceRow instances.
 */
export function transformMappedRows(
  mappedRows: MappedRawRow[],
  ctx: TransformContext
): NormalizedInvoiceRow[] {
  const supplierState = ctx.supplierGstin ? ctx.supplierGstin.substring(0, 2) : "";

  return mappedRows.map((raw, idx) => {
    const rawBuyerGstin = transformGstin(raw.buyerGstin);
    // Marketplace TCS exports repeat the seller's own GSTIN in a generic "gstin" column;
    // treating it as the buyer would wrongly classify every B2C row as B2B.
    const buyerGstin = rawBuyerGstin === ctx.supplierGstin?.toUpperCase() ? "" : rawBuyerGstin;
    const buyerName = String(raw.buyerName || FALLBACK_BUYER_NAME).trim();
    const rawInvoiceNumber = transformInvoiceNumber(raw.invoiceNumber);
    // GSTR-1 caps invoice numbers at 16 chars; last 16 preserve uniqueness of marketplace ids.
    const invoiceNumber =
      (rawInvoiceNumber.length > 16 ? rawInvoiceNumber.slice(-16) : rawInvoiceNumber) ||
      `${ctx.platformId.toUpperCase()}-${idx + 1}`;
    const invoiceDate = transformDate(raw.invoiceDate);
    const pos = transformStateCode(raw.placeOfSupply, buyerGstin);
    const hsnCode = transformHsn(raw.hsnCode);
    const itemDescription = String(raw.itemDescription ?? "").trim() || undefined;
    const uqc = transformUqc(raw.uqc);
    const quantity = transformNumber(raw.quantity, 0) || 1;
    const taxableValue = transformNumber(raw.taxableValue, 2);

    let cgstRate = transformTaxRate(raw.cgstRate);
    let sgstRate = transformTaxRate(raw.sgstRate);
    let igstRate = transformTaxRate(raw.igstRate);
    const cessRate = transformTaxRate(raw.cessRate);

    let cgstAmount = transformNumber(raw.cgstAmount, 2);
    let sgstAmount = transformNumber(raw.sgstAmount, 2);
    let igstAmount = transformNumber(raw.igstAmount, 2);
    const cessAmount = transformNumber(raw.cessAmount, 2);

    const isInterState = supplierState !== "" && pos !== "" && supplierState !== pos;

    // Many marketplace exports carry a single "gst_rate" / "total tax" column that lands on the
    // IGST fields. Redistribute it to match the actual place-of-supply before validation.
    if (!isInterState && igstRate > 0 && cgstRate === 0 && sgstRate === 0) {
      cgstRate = igstRate / 2;
      sgstRate = igstRate / 2;
      igstRate = 0;
    } else if (isInterState && igstRate === 0 && (cgstRate > 0 || sgstRate > 0)) {
      igstRate = cgstRate + sgstRate;
      cgstRate = 0;
      sgstRate = 0;
    } else if (igstRate === 0 && cgstRate === 0 && sgstRate === 0) {
      // Priority 2: no rate column in the file, so derive it from the tax the file did supply.
      // Guessing a default slab here would silently produce wrong tax on every row.
      const suppliedTax = igstAmount + cgstAmount + sgstAmount;
      const derived = deriveRateFromAmounts(taxableValue, suppliedTax);
      // Priority 3: a null derivation leaves the rate at zero, which the validator reports
      // so the user can correct the row in the error centre.
      if (derived !== null && isInterState) {
        igstRate = derived;
      } else if (derived !== null) {
        cgstRate = derived / 2;
        sgstRate = derived / 2;
      }
    }

    // A supply is either inter-state or intra-state, never both. Files often populate an IGST
    // column *and* CGST/SGST columns for the same row, so once the rate side is settled the
    // whole tax is collapsed into the matching bucket — otherwise it gets counted twice.
    const totalTax = igstAmount + cgstAmount + sgstAmount;
    if (igstRate > 0) {
      igstAmount = round2(totalTax);
      cgstAmount = 0;
      sgstAmount = 0;
    } else if (cgstRate > 0 || sgstRate > 0) {
      const half = round2(totalTax / 2);
      cgstAmount = half;
      sgstAmount = round2(totalTax - half);
      igstAmount = 0;
    }

    if (igstRate > 0 && igstAmount === 0) {
      igstAmount = Math.round(taxableValue * (igstRate / 100) * 100) / 100;
    }
    if (cgstRate > 0 && cgstAmount === 0) {
      cgstAmount = Math.round(taxableValue * (cgstRate / 100) * 100) / 100;
    }
    if (sgstRate > 0 && sgstAmount === 0) {
      sgstAmount = Math.round(taxableValue * (sgstRate / 100) * 100) / 100;
    }

    const calculatedTotal =
      Math.round((taxableValue + cgstAmount + sgstAmount + igstAmount + cessAmount) * 100) / 100;
    const totalValue = transformNumber(raw.totalValue, 2) || calculatedTotal;

    const originalInvoiceNumber = raw.originalInvoiceNumber
      ? String(raw.originalInvoiceNumber).trim()
      : undefined;
    const originalInvoiceDate = raw.originalInvoiceDate
      ? transformDate(raw.originalInvoiceDate)
      : undefined;

    // A marketplace TCS column sometimes repeats the seller's own GSTIN. That is not an operator
    // reference, and treating it as one would put the seller's own sales into Table 14. The same
    // guard applies to the configured fallback, which the file cannot override once it has a
    // value of its own — the export is the more specific source.
    const rawEcoGstin = transformGstin(raw.ecoGstin) || (ctx.fallbackEcoGstin ?? "").toUpperCase();
    const ecoGstin =
      rawEcoGstin && rawEcoGstin !== ctx.supplierGstin?.toUpperCase() ? rawEcoGstin : undefined;
    const ecoName = ecoGstin ? String(raw.ecoName || ctx.platformName).trim() : undefined;

    const isReturn = !!(
      originalInvoiceNumber ||
      taxableValue < 0 ||
      ctx.fileTypeId?.includes("return") ||
      ctx.fileTypeId?.includes("credit_note")
    );
    const transactionType: TransactionType = isReturn ? "Return" : "Sales";

    // Category determination
    let invoiceType: InvoiceCategory = "B2CS";
    if (isReturn) {
      invoiceType = buyerGstin.length === 15 || originalInvoiceNumber ? "CDNR" : "B2CS";
    } else if (buyerGstin.length === 15) {
      invoiceType = "B2B";
    } else if (isInterState && taxableValue > 250000) {
      invoiceType = "B2CL";
    } else {
      invoiceType = "B2CS";
    }

    return {
      id: `tr-${idx + 1}-${Date.now()}`,
      rowIndex: idx + 2,
      sourcePlatformId: ctx.platformId,
      sourcePlatformName: ctx.platformName,
      sourceFileName: ctx.fileName,
      sourceFileType: ctx.fileTypeId,
      transactionType,
      invoiceNumber,
      invoiceDate,
      invoiceType,
      buyerName,
      buyerGstin,
      placeOfSupply: pos,
      hsnCode,
      itemDescription,
      uqc,
      quantity,
      taxableValue,
      cgstRate,
      sgstRate,
      igstRate,
      cessRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
      cessAmount,
      totalValue,
      originalInvoiceNumber,
      originalInvoiceDate,
      ecoGstin,
      ecoName,
      errors: [],
    };
  });
}
