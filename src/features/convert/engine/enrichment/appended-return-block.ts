import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Handles the returns an accountant appends to the bottom of a sales export.
 *
 * Sellers are commonly handed their Meesho sales file with the month's returns
 * typed in underneath, and they upload it as it came — sometimes alongside the
 * separate returns file, sometimes instead of it. Both have to work:
 *
 *   sales (with block) + returns file  the block restates the returns file and
 *                                      must not be counted a second time
 *   sales (with block) alone           the block is the only record of those
 *                                      credit notes and must be kept
 *
 * The appended rows are recognisable because they carry no order reference.
 * Meesho itself writes `sub_order_num` on every row it exports; a row without
 * one was added by hand. That is the discriminator used here — not the blank
 * tax rate those rows also tend to have, which is a habit of one accountant
 * rather than a property of the case.
 *
 * Until now nothing looked for this. The rows happened to be discarded because
 * the adapter treated their blank rate as fatal, which gave the right total for
 * the duplicate case by accident and the wrong one for every other: a seller
 * uploading the sales file alone lost every credit note in it.
 */

/** Two figures are the same document when they agree to the paisa. */
const PAISA = 0.02;

export interface AppendedBlockResult {
  rows: NormalizedInvoiceRow[];
  /** What was dropped, and why, for the import summary. */
  dropped: { placeOfSupply: string; taxableValue: number; matchedAgainst: string }[];
}

function isUnreferenced(row: NormalizedInvoiceRow): boolean {
  return row.sourcePlatformId === "meesho" && row.invoiceNumber.trim() === "";
}

/**
 * Removes appended credit notes that restate one already reported elsewhere.
 *
 * Only the *unreferenced* copy is ever dropped. The identified row — the one
 * carrying an order number, from Meesho's own returns export — is always the
 * one kept, so a document is never lost in favour of a hand-typed restatement
 * of it, whichever order the files were uploaded in.
 *
 * Matching is on absolute taxable value and place of supply. The two copies
 * share no reference at all (the appended row has none), so the amount and the
 * state are what identifies them, and a match must be exact.
 */
export function dropAppendedDuplicateReturns(rows: NormalizedInvoiceRow[]): AppendedBlockResult {
  const identifiedReturns = rows.filter(
    (r) => r.transactionType === "Return" && !isUnreferenced(r)
  );
  if (identifiedReturns.length === 0) return { rows, dropped: [] };

  // Consumed as they are matched: two appended rows must not both collapse
  // onto the same reported credit note.
  const available = identifiedReturns.map((r) => ({
    row: r,
    taxable: Math.abs(r.taxableValue),
    pos: r.placeOfSupply,
    taken: false,
  }));

  const dropped: AppendedBlockResult["dropped"] = [];
  const kept: NormalizedInvoiceRow[] = [];

  for (const row of rows) {
    if (row.transactionType !== "Return" || !isUnreferenced(row)) {
      kept.push(row);
      continue;
    }

    const value = Math.abs(row.taxableValue);
    const twin = available.find(
      (c) => !c.taken && c.pos === row.placeOfSupply && Math.abs(c.taxable - value) <= PAISA
    );

    if (!twin) {
      // No counterpart, so this is the only record of the credit note.
      kept.push(row);
      continue;
    }

    twin.taken = true;
    dropped.push({
      placeOfSupply: row.placeOfSupply,
      taxableValue: value,
      matchedAgainst: twin.row.invoiceNumber,
    });
  }

  return { rows: kept, dropped };
}

/**
 * Flags the appended rows that survived, so the user sees what was taken on
 * trust rather than having it slipped into the return.
 *
 * A row with no invoice number can still be reported — Table 7 is consolidated
 * by rate and place of supply, and asks for no document reference — but the
 * figures came from a spreadsheet someone edited, not from the marketplace,
 * and that is worth saying out loud.
 */
export function flagUnreferencedRows(rows: NormalizedInvoiceRow[]): NormalizedInvoiceRow[] {
  return rows.map((row) => {
    if (!isUnreferenced(row)) return row;
    const note =
      row.transactionType === "Return"
        ? "Added below the sales export by hand, with no order reference, and no matching entry in a returns file. Counted once — check it is not already reported."
        : "Added below the sales export by hand, with no order reference. Counted as a supply — check it belongs in this period.";
    return { ...row, reviews: [...(row.reviews ?? []), note] };
  });
}
