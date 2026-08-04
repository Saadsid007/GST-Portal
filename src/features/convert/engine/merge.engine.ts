import { FALLBACK_BUYER_NAME, FALLBACK_HSN } from "./transformation/transformers";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

export interface ParsedFileBatch {
  platformId: string;
  platformName: string;
  fileName: string;
  fileTypeId: string;
  rows: NormalizedInvoiceRow[];
}

export interface MergeResult {
  mergedRows: NormalizedInvoiceRow[];
  duplicates: { invoiceNumber: string; sources: string[] }[];
  totalRawRows: number;
}

/**
 * Marketplace return/credit-note reports drop the columns that only matter at the point of
 * sale — place of supply, buyer GSTIN, HSN, tax rates. Those rows are not incomplete data,
 * they are references to an invoice we have already parsed, so the sale supplies the values.
 *
 * That includes the marketplace itself: a return belongs to whichever marketplace made the
 * original supply, not to whichever file it happened to arrive in. A consolidated or
 * mis-filed returns sheet must never move revenue between marketplaces.
 */
function inheritSaleAttributesForReturns(rows: NormalizedInvoiceRow[]): void {
  const salesByInvoice = new Map<string, NormalizedInvoiceRow[]>();
  for (const row of rows) {
    if (row.transactionType !== "Sales") continue;
    const key = row.invoiceNumber.trim().toLowerCase();
    if (!key) continue;
    const bucket = salesByInvoice.get(key);
    if (bucket) bucket.push(row);
    else salesByInvoice.set(key, [row]);
  }

  for (const row of rows) {
    if (row.transactionType !== "Return") continue;
    const key = (row.originalInvoiceNumber || row.invoiceNumber).trim().toLowerCase();
    const sale = key ? matchOriginalSale(row, salesByInvoice.get(key)) : undefined;
    if (!sale) continue;

    // The original invoice is the authority on which marketplace made the supply, so this
    // overwrites the batch tagging rather than filling a gap.
    if (sale.sourcePlatformId) {
      row.sourcePlatformId = sale.sourcePlatformId;
      row.sourcePlatformName = sale.sourcePlatformName;
    }

    if (!row.originalInvoiceNumber) row.originalInvoiceNumber = sale.invoiceNumber;
    if (!row.originalInvoiceDate) row.originalInvoiceDate = sale.invoiceDate;
    // Place of supply decides inter- vs intra-state, so anything the transformation stage
    // inferred without it (rates, tax split) was a guess and the sale overrides it.
    const posWasMissing = !row.placeOfSupply;
    if (posWasMissing) row.placeOfSupply = sale.placeOfSupply;
    if (!row.buyerGstin) row.buyerGstin = sale.buyerGstin;
    if (!row.buyerName || row.buyerName === FALLBACK_BUYER_NAME) row.buyerName = sale.buyerName;
    if (!row.hsnCode || row.hsnCode === FALLBACK_HSN) row.hsnCode = sale.hsnCode;
    if (!row.itemDescription) row.itemDescription = sale.itemDescription;
    if (!row.uqc || row.uqc === "OTH") row.uqc = sale.uqc;
    if (!row.ecoGstin) {
      row.ecoGstin = sale.ecoGstin;
      row.ecoName = sale.ecoName;
    }
    if (!row.invoiceType) row.invoiceType = sale.invoiceType;

    const hasRate = row.igstRate > 0 || row.cgstRate > 0 || row.sgstRate > 0;
    if (posWasMissing || !hasRate) {
      row.igstRate = sale.igstRate;
      row.cgstRate = sale.cgstRate;
      row.sgstRate = sale.sgstRate;
      row.cessRate = sale.cessRate;
    }

    realignTaxSplit(row, sale);
  }
}

/**
 * Picks the sale a return refers to when an invoice number is not globally unique.
 *
 * Marketplace order numbers only have to be unique within their own marketplace, so two
 * platforms can legitimately issue the same one. First-write-wins would then attribute the
 * return to whichever file was uploaded first. Preference order:
 *
 *  1. a sale on the platform the return arrived tagged with — the ordinary case;
 *  2. the only candidate, when the number is unique across the upload;
 *  3. nothing. An ambiguous number is left alone rather than guessed at, since a wrong
 *     link would silently move taxable value between marketplaces.
 */
function matchOriginalSale(
  row: NormalizedInvoiceRow,
  candidates: NormalizedInvoiceRow[] | undefined
): NormalizedInvoiceRow | undefined {
  if (!candidates || candidates.length === 0) return undefined;

  const samePlatform = candidates.filter((c) => c.sourcePlatformId === row.sourcePlatformId);
  if (samePlatform.length > 0) return samePlatform[0];

  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Without a place of supply the transformation stage could not tell inter- from intra-state,
 * so a return's tax may sit in the wrong buckets. Once the sale is known, move the total across.
 */
function realignTaxSplit(row: NormalizedInvoiceRow, sale: NormalizedInvoiceRow): void {
  const saleIsInterState = sale.igstAmount !== 0 || sale.igstRate > 0;
  const rowIsInterState = row.igstAmount !== 0;
  if (saleIsInterState === rowIsInterState) return;

  const totalTax = row.igstAmount + row.cgstAmount + row.sgstAmount;
  if (totalTax === 0) return;

  if (saleIsInterState) {
    row.igstAmount = round2(totalTax);
    row.cgstAmount = 0;
    row.sgstAmount = 0;
  } else {
    const half = round2(totalTax / 2);
    row.cgstAmount = half;
    row.sgstAmount = round2(totalTax - half);
    row.igstAmount = 0;
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Merge Engine — combines transactions from all uploaded files & marketplaces,
 * tags source metadata, and flags duplicate invoices across files.
 */
export function mergeTransactions(batches: ParsedFileBatch[]): MergeResult {
  let overallRowIndex = 1;
  const mergedRows: NormalizedInvoiceRow[] = [];
  const invoiceSourceMap = new Map<string, string[]>();
  let totalRawRows = 0;

  for (const batch of batches) {
    totalRawRows += batch.rows.length;

    for (const row of batch.rows) {
      const invKey = row.invoiceNumber.trim().toLowerCase();
      if (invKey) {
        const sourceLabel = `${batch.platformName} (${batch.fileName})`;
        const sources = invoiceSourceMap.get(invKey) || [];
        sources.push(sourceLabel);
        invoiceSourceMap.set(invKey, sources);
      }

      // Check if file type indicates a return file e.g. "returns" or "credit_notes"
      const isReturnFileType =
        batch.fileTypeId.includes("return") || batch.fileTypeId.includes("credit_note");
      const transactionType =
        row.transactionType ?? (isReturnFileType || row.taxableValue < 0 ? "Return" : "Sales");

      const taggedRow: NormalizedInvoiceRow = {
        ...row,
        id: `m-row-${overallRowIndex}-${Date.now()}`,
        rowIndex: overallRowIndex++,
        sourcePlatformId: batch.platformId,
        sourcePlatformName: batch.platformName,
        sourceFileName: batch.fileName,
        sourceFileType: batch.fileTypeId,
        transactionType,
      };

      mergedRows.push(taggedRow);
    }
  }

  inheritSaleAttributesForReturns(mergedRows);

  // Collect duplicates
  const duplicates: { invoiceNumber: string; sources: string[] }[] = [];
  for (const [invKey, sources] of invoiceSourceMap.entries()) {
    if (sources.length > 1) {
      duplicates.push({
        invoiceNumber: invKey,
        sources,
      });
    }
  }

  return {
    mergedRows,
    duplicates,
    totalRawRows,
  };
}
