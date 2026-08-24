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
export function classifyCompanionSheet(sheetName: string): CompanionSheet | null {
  const name = sheetName.trim().toLowerCase();
  if (!name) return null;

  for (const rule of COMPANION_RULES) {
    if (rule.sheet.test(name)) return { reason: rule.reason };
  }

  return null;
}
