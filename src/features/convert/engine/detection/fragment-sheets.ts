import type { ReconstructedTable } from "@/features/convert/engine/universal/types";

/**
 * Finds sheets that are a working copy of another sheet in the same workbook.
 *
 * Sellers and their accountants pull a few columns out of an export onto a
 * second tab to total them up, and the tab travels with the file on upload.
 * One real case: a Meesho workbook whose first sheet holds 655 orders and
 * whose "Sheet2" holds the same 640 rows reduced to rate, taxable value, tax
 * and state.
 *
 * Imported, that fragment adds the seller's turnover a second time. It cannot
 * be caught by name, and it cannot be caught by "has no invoice number"
 * either — Flipkart's own Section 7(A)(2) and 7(B)(2) are rate-wise summaries
 * with no invoice number, and those are real data we do report.
 *
 * What identifies it is the pair: a sheet whose columns are all present on
 * another sheet of the same workbook, where that other sheet can identify its
 * documents and this one cannot. A genuine summary sheet stands alone; a
 * copy-paste fragment is, by construction, a subset of what it was copied
 * from.
 */

/** Columns that let a row be tied to a document. */
const IDENTIFIER_HINTS = [
  "invoiceno",
  "invoicenumber",
  "billno",
  "notenumber",
  "orderid",
  "orderno",
  "suborder",
  "subordernum",
  "invoicedate",
  "orderdate",
  "identifier",
  "shipmentid",
  "transactionid",
];

function normalise(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasIdentifier(headers: string[]): boolean {
  const normalised = headers.map(normalise);
  return IDENTIFIER_HINTS.some((hint) => normalised.some((h) => h.includes(hint)));
}

export interface FragmentSheet {
  /** The sheet to skip. */
  sheetName: string;
  /** The sheet it duplicates, named so the user can see why. */
  copiedFrom: string;
  reason: string;
}

/**
 * Returns the fragments among a workbook's tables.
 *
 * Takes all of one file's sheets at once, because the decision is relational:
 * nothing about a fragment looks wrong until it is set beside its source.
 */
export function detectFragmentSheets(
  tables: { fileName: string; table: ReconstructedTable }[]
): FragmentSheet[] {
  const fragments: FragmentSheet[] = [];

  const byFile = new Map<string, { fileName: string; table: ReconstructedTable }[]>();
  for (const entry of tables) {
    const list = byFile.get(entry.fileName) ?? [];
    list.push(entry);
    byFile.set(entry.fileName, list);
  }

  for (const sheets of byFile.values()) {
    if (sheets.length < 2) continue;

    for (const candidate of sheets) {
      if (candidate.table.headers.length === 0) continue;
      if (hasIdentifier(candidate.table.headers)) continue;

      const candidateCols = new Set(candidate.table.headers.map(normalise));

      for (const source of sheets) {
        if (source === candidate) continue;
        if (!hasIdentifier(source.table.headers)) continue;

        const sourceCols = new Set(source.table.headers.map(normalise));
        const isSubset = [...candidateCols].every((c) => sourceCols.has(c));
        if (!isSubset) continue;

        fragments.push({
          sheetName: candidate.table.sheetName,
          copiedFrom: source.table.sheetName,
          reason:
            `Looks like a working copy of "${source.table.sheetName}" — same columns, ` +
            `but no invoice or order reference. Importing it would count these supplies twice.`,
        });
        break;
      }
    }
  }

  return fragments;
}
