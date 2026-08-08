import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import type { Evidence, RecoveryRecord, WorkbookUnderstanding } from "./types";
import { snapToSlab } from "./signals";

/**
 * Layer 6 — reasoning and recovery.
 *
 * A missing value is never guessed. Each recovery follows an explicit chain of
 * reasoning, and every result is challenged before it is accepted: the derived
 * value is put back through GST arithmetic and rejected if it does not
 * reproduce the figures already in the row. A rejected inference leaves the
 * field missing, which is the honest outcome — a fabricated rate would be
 * carried into a filed return and become the user's liability.
 */

/** Two paise. Marketplace exports round per line; this is the noise floor. */
const MONEY_TOLERANCE = 0.02;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function totalTax(row: NormalizedInvoiceRow): number {
  return row.cgstAmount + row.sgstAmount + row.igstAmount;
}

function hasRate(row: NormalizedInvoiceRow): boolean {
  return row.igstRate > 0 || row.cgstRate > 0 || row.sgstRate > 0;
}

/** True when the row's tax amounts are consistent with its stated rate. */
function arithmeticHolds(row: NormalizedInvoiceRow, ratePercent: number): boolean {
  if (row.taxableValue === 0) return true;
  const expected = round2((Math.abs(row.taxableValue) * ratePercent) / 100);
  const actual = round2(Math.abs(totalTax(row)));
  return Math.abs(expected - actual) <= Math.max(MONEY_TOLERANCE, expected * 0.005);
}

/**
 * Applies a slab to a row, splitting it the way the place of supply demands:
 * intra-state supplies split into equal CGST and SGST halves, inter-state
 * supplies carry the whole rate as IGST.
 */
function applyRate(row: NormalizedInvoiceRow, ratePercent: number, interState: boolean): void {
  if (interState) {
    row.igstRate = ratePercent;
    row.cgstRate = 0;
    row.sgstRate = 0;
    row.igstAmount = round2((row.taxableValue * ratePercent) / 100);
    row.cgstAmount = 0;
    row.sgstAmount = 0;
  } else {
    row.igstRate = 0;
    row.cgstRate = ratePercent / 2;
    row.sgstRate = ratePercent / 2;
    row.igstAmount = 0;
    row.cgstAmount = round2((row.taxableValue * ratePercent) / 200);
    row.sgstAmount = round2((row.taxableValue * ratePercent) / 200);
  }
}

/**
 * Rate recovery, in order of how directly the evidence supports the answer.
 *
 * 1. Tax amounts already in the row divided by the taxable value.
 * 2. The invoice total less the taxable value, when tax was never broken out.
 * 3. The slab used by other rows sharing this row's HSN code.
 *
 * Only a result landing on a notified slab is accepted. An arbitrary percentage
 * means the source columns disagree with each other, and freezing that
 * disagreement into a rate would hide a real data problem.
 */
function recoverRate(
  row: NormalizedInvoiceRow,
  hsnSlabs: Map<string, number>,
  interState: boolean
): { rate: number; path: string[]; evidence: Evidence[]; confidence: number } | null {
  const taxable = Math.abs(row.taxableValue);
  if (taxable === 0) return null;

  const tax = Math.abs(totalTax(row));
  if (tax > 0) {
    const percent = (tax / taxable) * 100;
    const slab = snapToSlab(percent);
    if (slab !== null && slab > 0) {
      return {
        rate: slab,
        confidence: 99,
        path: [
          `Tax of ${round2(tax)} on a taxable value of ${round2(taxable)}`,
          `Implied rate ${round2(percent)}%`,
          `Lands on the notified ${slab}% slab`,
        ],
        evidence: [
          {
            source: "ARITHMETIC",
            detail: `${round2(tax)} ÷ ${round2(taxable)} = ${round2(percent)}%, which is the ${slab}% slab`,
            weight: 60,
          },
          { source: "GST_RULE", detail: `${slab}% is a rate notified under the Act`, weight: 30 },
        ],
      };
    }
  }

  if (row.totalValue !== 0) {
    const implied = Math.abs(row.totalValue) - taxable;
    if (implied > 0) {
      const percent = (implied / taxable) * 100;
      const slab = snapToSlab(percent);
      if (slab !== null && slab > 0) {
        return {
          rate: slab,
          confidence: 92,
          path: [
            `Invoice total ${round2(Math.abs(row.totalValue))} less taxable value ${round2(taxable)}`,
            `Residual ${round2(implied)} implies ${round2(percent)}%`,
            `Lands on the notified ${slab}% slab`,
          ],
          evidence: [
            {
              source: "ARITHMETIC",
              detail: `Total minus taxable leaves ${round2(implied)}, which is ${slab}% of the taxable value`,
              weight: 50,
            },
          ],
        };
      }
    }
  }

  const hsnSlab = row.hsnCode ? hsnSlabs.get(row.hsnCode) : undefined;
  if (hsnSlab !== undefined && hsnSlab > 0) {
    return {
      rate: hsnSlab,
      confidence: 74,
      path: [
        `No rate or tax on this row`,
        `Other rows with HSN ${row.hsnCode} in this file are taxed at ${hsnSlab}%`,
      ],
      evidence: [
        {
          source: "CROSS_ROW",
          detail: `Every other row carrying HSN ${row.hsnCode} in this upload uses ${hsnSlab}%`,
          weight: 40,
        },
      ],
    };
  }

  // Interstate flag is part of the applied result, not the search.
  void interState;
  return null;
}

/** The slab each HSN is taxed at, where the file is unanimous about it. */
function buildHsnSlabs(rows: NormalizedInvoiceRow[]): Map<string, number> {
  const observed = new Map<string, Set<number>>();

  for (const row of rows) {
    if (!row.hsnCode || !hasRate(row)) continue;
    const rate = row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate;
    if (rate <= 0) continue;
    const set = observed.get(row.hsnCode) ?? new Set<number>();
    set.add(rate);
    observed.set(row.hsnCode, set);
  }

  const unanimous = new Map<string, number>();
  for (const [hsn, rates] of observed) {
    // A split HSN means the file itself disagrees; inferring from it would pick
    // one of two live possibilities at random.
    if (rates.size === 1) {
      const [only] = [...rates];
      if (only !== undefined) unanimous.set(hsn, only);
    }
  }
  return unanimous;
}

export interface RecoveryOutcome {
  rows: NormalizedInvoiceRow[];
  recoveries: RecoveryRecord[];
}

/**
 * Recovers what the workbook left out, row by row, and records why.
 *
 * Mutates copies, never the caller's rows.
 */
export function recoverRows(
  input: NormalizedInvoiceRow[],
  understanding: WorkbookUnderstanding,
  supplierStateCode: string
): RecoveryOutcome {
  const rows = input.map((row) => ({ ...row }));
  const recoveries: RecoveryRecord[] = [];
  const hsnSlabs = buildHsnSlabs(rows);

  rows.forEach((row, index) => {
    const interState = Boolean(
      supplierStateCode && row.placeOfSupply && supplierStateCode !== row.placeOfSupply
    );

    // ── Place of supply from the buyer's GSTIN ──────────────────────────────
    // The first two characters of a GSTIN are the state code by construction,
    // so this is a reading of the data rather than an inference about it.
    if (!row.placeOfSupply && row.buyerGstin.length === 15) {
      const code = row.buyerGstin.slice(0, 2);
      row.placeOfSupply = code;
      recoveries.push({
        rowIndex: index,
        field: "placeOfSupply",
        value: code,
        confidence: 100,
        path: [`Buyer GSTIN ${row.buyerGstin}`, `First two characters are the state code`],
        evidence: [
          {
            source: "GST_RULE",
            detail: "A GSTIN's leading two digits are the registered state code",
            weight: 60,
          },
        ],
      });
    }

    // ── Rate ────────────────────────────────────────────────────────────────
    if (!hasRate(row)) {
      const recovered = recoverRate(row, hsnSlabs, interState);
      if (recovered) {
        const before = { ...row };
        applyRate(row, recovered.rate, interState);

        // Self-validation: the recovered rate must reproduce any tax figures the
        // file already stated. If it does not, the inference is withdrawn.
        const taxWasStated = Math.abs(totalTax(before)) > 0;
        if (taxWasStated && !arithmeticHolds(before, recovered.rate)) {
          Object.assign(row, before);
        } else {
          recoveries.push({
            rowIndex: index,
            field: "gstRate",
            value: `${recovered.rate}%`,
            confidence: recovered.confidence,
            path: [
              ...recovered.path,
              interState
                ? "Applied as IGST — supplier and place of supply are in different states"
                : "Split into equal CGST and SGST halves — intra-state supply",
            ],
            evidence: recovered.evidence,
          });
        }
      }
    }

    // ── Tax amounts from a stated rate ──────────────────────────────────────
    if (hasRate(row) && Math.abs(totalTax(row)) === 0 && row.taxableValue !== 0) {
      const rate = row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate;
      applyRate(row, rate, interState);
      recoveries.push({
        rowIndex: index,
        field: "taxSplit",
        value: `${round2(totalTax(row))}`,
        confidence: 97,
        path: [
          `File states a ${rate}% rate but no tax amount`,
          `${rate}% of ${round2(row.taxableValue)}`,
          interState ? "Charged as IGST" : "Split into CGST and SGST",
        ],
        evidence: [
          {
            source: "ARITHMETIC",
            detail: `Computed from the rate the file itself supplies`,
            weight: 55,
          },
        ],
      });
    }

    // ── Taxable value from a gross total ────────────────────────────────────
    if (row.taxableValue === 0 && row.totalValue !== 0 && hasRate(row)) {
      const rate = row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate;
      const taxable = round2(row.totalValue / (1 + rate / 100));
      row.taxableValue = taxable;
      applyRate(row, rate, interState);
      recoveries.push({
        rowIndex: index,
        field: "taxableValue",
        value: `${taxable}`,
        confidence: 90,
        path: [
          `Only a gross total of ${round2(row.totalValue)} was supplied`,
          `Backed out at the stated ${rate}% rate`,
        ],
        evidence: [
          {
            source: "ARITHMETIC",
            detail: `${round2(row.totalValue)} ÷ ${1 + rate / 100} = ${taxable}`,
            weight: 45,
          },
        ],
      });
    }

    // ── Total ───────────────────────────────────────────────────────────────
    if (row.totalValue === 0 && row.taxableValue !== 0) {
      row.totalValue = round2(row.taxableValue + totalTax(row) + row.cessAmount);
    }

    // ── Transaction type ────────────────────────────────────────────────────
    // A negative line in a mixed workbook is a return, whatever the row is
    // labelled. This is the document-level understanding reaching the row.
    if (
      !row.transactionType &&
      (understanding.documentType === "MIXED" || understanding.documentType === "RETURNS")
    ) {
      const negative = row.taxableValue < 0;
      const type = negative || understanding.documentType === "RETURNS" ? "Return" : "Sales";
      row.transactionType = type;
      recoveries.push({
        rowIndex: index,
        field: "transactionType",
        value: type,
        confidence: negative ? 96 : 80,
        path: [
          `Workbook understood as ${understanding.documentType}`,
          negative
            ? "Row carries a negative taxable value"
            : "Row carries a positive taxable value",
        ],
        evidence: [
          {
            source: "DOCUMENT_CONTEXT",
            detail: negative
              ? "Negative amounts in a mixed workbook are reversals"
              : "Positive amounts in a mixed workbook are sales",
            weight: 40,
          },
        ],
      });
    }
  });

  return { rows, recoveries };
}
