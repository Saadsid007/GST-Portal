import { validateInvoices } from "@/features/convert/domain/validator";
import { generateGstr1Json } from "@/features/convert/domain/gstr1-json.generator";
import { processNetSales } from "@/features/convert/engine/net-sales.engine";
import { generateStatement } from "@/features/convert/engine/statement.engine";
import type {
  NetSalesStatement,
  NormalizedInvoiceRow,
} from "@/features/convert/types/convert.types";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Writes a GST rate onto a row and derives the tax amounts from it.
 *
 * Setting the rate alone is not enough: the tax-math check compares each amount against the
 * rate, so a rate applied over stale amounts turns one error into a different one. The row had
 * no rate of its own, which means its amounts were never verifiable anyway — the rate is the
 * more trustworthy of the two, so the amounts are rebuilt from it.
 *
 * The supplier's state decides the bucket. A rate in the wrong bucket would fail the
 * inter-/intra-state check even though the number itself is right.
 */
export function applyRateToRow(
  row: NormalizedInvoiceRow,
  rate: number,
  supplierState: string
): NormalizedInvoiceRow {
  const sign = row.taxableValue < 0 ? -1 : 1;
  const tax = (r: number) => round2(Math.abs(row.taxableValue) * (r / 100)) * sign;
  const isInterState = Boolean(supplierState) && supplierState !== row.placeOfSupply;

  if (isInterState) {
    return {
      ...row,
      igstRate: rate,
      cgstRate: 0,
      sgstRate: 0,
      igstAmount: tax(rate),
      cgstAmount: 0,
      sgstAmount: 0,
    };
  }

  const half = rate / 2;
  return {
    ...row,
    igstRate: 0,
    cgstRate: half,
    sgstRate: half,
    igstAmount: 0,
    cgstAmount: tax(half),
    sgstAmount: tax(half),
  };
}

export interface RevalidatedPipeline {
  rows: NormalizedInvoiceRow[];
  statement: NetSalesStatement;
  gstr1Json: string;
}

/**
 * Re-runs net sales → validation → statement → JSON over an edited row set.
 *
 * Every mutation path shares this so an edit, an auto-fix and an applied rate all leave the
 * workbench in the same state — a divergence here shows up as a stale error badge.
 */
export function revalidateRows(
  rows: NormalizedInvoiceRow[],
  gstinNumber: string
): RevalidatedPipeline {
  const netResult = processNetSales(rows);
  const validation = validateInvoices(netResult.processedRows, gstinNumber);
  const statement = generateStatement(
    netResult,
    validation.issues,
    validation.validCount,
    validation.errorCount,
    validation.reviewCount
  );

  return {
    rows: validation.rows,
    statement,
    gstr1Json: generateGstr1Json(validation.rows, gstinNumber, "", statement as never),
  };
}
