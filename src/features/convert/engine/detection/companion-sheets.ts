/**
 * Recognises sheets that sit alongside the transaction data but are not
 * transaction data.
 *
 * Marketplace GSTR workbooks ship a bundle: instructions, an HSN roll-up, a
 * document-series count, a TCS summary, amendment tables. None of them are line
 * items, and every figure in them is something the engine derives from the
 * transactions itself.
 *
 * Without this they fall through platform detection, land in the "unrecognized"
 * bucket and get sent to the AI mapper — which then asks the user to pick an
 * invoice number from "HSN Number" or "Total Number of Invoices". The questions
 * are unanswerable because the premise is wrong: the sheet has no invoices.
 *
 * Skipping them is not data loss. Importing them would be: an HSN summary read
 * as line items double-counts every rupee already counted from the sale rows.
 */

export interface CompanionSheet {
  /** Shown to the user in place of an AI mapping prompt. */
  reason: string;
}

interface Rule {
  reason: string;
  /** Matched against the lower-cased sheet name. */
  sheet: RegExp;
}

/**
 * Header markers that identify an Excel PivotTable.
 *
 * Accountants routinely build a pivot next to the raw export — a state-wise
 * roll-up of taxable value, say — and save it into the same workbook. The
 * pivot then travels with the file when it is uploaded.
 *
 * It has to be turned away rather than imported: its rows are states, not
 * supplies, and its columns are tax rates, not fields. Read as line items it
 * would add the seller's whole turnover a second time. It cannot be caught by
 * sheet name — sellers call these anything, including "MESHOO" and "Sheet1" —
 * but "Row Labels" beside a "Grand Total" is Excel's own wording and appears in
 * no marketplace export.
 */
const PIVOT_MARKERS = ["row labels", "column labels", "grand total"];

/**
 * Excel's own naming for a pivot's value field — "Sum of total_taxable_sale_value".
 * Counted as a marker because the header row a reconstructor settles on is
 * often the one carrying this rather than the one carrying "Row Labels": the
 * two sit on different rows of the same pivot.
 */
const PIVOT_AGGREGATE = /^(sum|count|average|max|min|product|stddev|var) of\s+\S/;

/**
 * Ordered most specific first. Section numbers are matched with the punctuation
 * made optional, since exports vary between "7(B)(2)", "7B2" and "7 B 2".
 */
const COMPANION_RULES: Rule[] = [
  {
    // Flipkart's workbook opens with this; it is prose, not a table.
    sheet: /^help$|instructions?$|read\s*me/,
    reason: "Instruction sheet — no transaction data",
  },
  {
    // GSTR-1 Table 12: HSN-wise summary, derived from the sale rows.
    sheet: /section\s*12\b/,
    reason: "HSN summary (Table 12) — the engine builds this from your sales",
  },
  {
    // GSTR-1 Table 13: documents issued, a count of invoice series.
    sheet: /section\s*13\b/,
    reason: "Document series summary (Table 13) — counts, not invoices",
  },
  {
    // An HSN register a CA keeps beside the invoice register. It is one row
    // per commodity, already totalled — importing it would count the same
    // turnover twice, once from the invoices and once from their summary.
    sheet: /^hsn[\s_/-]*(summary|register|wise.*)$/,
    reason: "HSN summary — the engine builds Table 12 from your invoices",
  },
  {
    // GSTR-8 is the operator's own return; TCS is reconciled separately.
    sheet: /gstr\s*-?\s*8\b/,
    reason: "TCS summary (GSTR-8) — reconciled in the TCS step, not imported as sales",
  },
  {
    // Tables 9/10/11: amendments to earlier periods.
    sheet: /section\s*(9|10a|10b|11)\b|amend/,
    reason: "Amendment table — belongs to an earlier return period",
  },
];

/**
 * Returns why a sheet should be skipped, or null when it may hold transactions.
 *
 * Deliberately keyed on the sheet name alone. Header-based guessing is what put
 * these sheets in front of the AI in the first place — an HSN summary and a sale
 * row share most of their columns.
 */
export function classifyCompanionSheet(
  sheetName: string,
  headers: string[] = []
): CompanionSheet | null {
  const name = sheetName.trim().toLowerCase();

  // Checked before the name rules, because a pivot can be called anything.
  if (isPivotTable(headers)) {
    return {
      reason:
        "This looks like an Excel PivotTable (it has Row Labels and a Grand Total), " +
        "not a list of transactions. Upload the sheet holding the original rows instead.",
    };
  }

  if (!name) return null;

  for (const rule of COMPANION_RULES) {
    if (rule.sheet.test(name)) return { reason: rule.reason };
  }

  return null;
}

/**
 * Two markers are required, not one. "Grand Total" alone appears as a genuine
 * last row in plenty of hand-kept registers, and rejecting those would throw
 * away real invoices.
 */
function isPivotTable(headers: string[]): boolean {
  const normalised = headers.map((h) => h.trim().toLowerCase());
  let hits = PIVOT_MARKERS.filter((marker) => normalised.some((h) => h === marker)).length;
  if (normalised.some((h) => PIVOT_AGGREGATE.test(h))) hits++;
  return hits >= 2;
}
