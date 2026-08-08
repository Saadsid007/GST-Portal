import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import type { DuplicateVerdict } from "./types";

/**
 * Duplicate intelligence.
 *
 * Invoice number alone is not an identity. A five-line invoice repeats its
 * number on every line, and a return quotes the number of the sale it reverses.
 * Treating either as a duplicate deletes real turnover from the return, so the
 * key is built from the whole business identity of the row and the outcome is
 * classified rather than reduced to a yes/no.
 *
 * Nothing here removes rows. It explains what it found and leaves the decision
 * where it belongs.
 */

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function tax(row: NormalizedInvoiceRow): number {
  return round2(row.cgstAmount + row.sgstAmount + row.igstAmount + row.cessAmount);
}

/**
 * Identity of the document a row belongs to. Deliberately excludes amounts:
 * two lines of one invoice must land in the same group so they can be
 * recognised as line items rather than copies.
 */
function documentKey(row: NormalizedInvoiceRow): string {
  return [
    row.sourcePlatformId ?? "",
    row.transactionType ?? "Sales",
    row.invoiceNumber.trim().toLowerCase(),
    row.buyerGstin.trim().toLowerCase(),
    row.placeOfSupply,
  ].join("::");
}

/** Identity of the line itself, including what it is worth. */
function lineKey(row: NormalizedInvoiceRow): string {
  return [
    documentKey(row),
    row.hsnCode,
    round2(row.taxableValue),
    tax(row),
    row.quantity,
    row.invoiceDate,
  ].join("::");
}

export function classifyDuplicates(rows: NormalizedInvoiceRow[]): DuplicateVerdict[] {
  const byDocument = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const key = documentKey(row);
    const bucket = byDocument.get(key) ?? [];
    bucket.push(index);
    byDocument.set(key, bucket);
  });

  const verdicts: DuplicateVerdict[] = [];

  for (const [key, indexes] of byDocument) {
    if (indexes.length < 2) continue;

    // Within one document, rows identical down to the amount are copies.
    const byLine = new Map<string, number[]>();
    for (const index of indexes) {
      const row = rows[index];
      if (!row) continue;
      const lk = lineKey(row);
      const bucket = byLine.get(lk) ?? [];
      bucket.push(index);
      byLine.set(lk, bucket);
    }

    for (const [, group] of byLine) {
      if (group.length > 1) {
        verdicts.push({
          businessKey: key,
          rowIndexes: group,
          classification: "EXACT_DUPLICATE",
          explanation: `${group.length} rows share the same invoice, buyer, place of supply, HSN, quantity, taxable value and tax. Identical down to the amount, so these are repeated records rather than separate lines.`,
        });
      }
    }

    const distinctLines = byLine.size;
    if (distinctLines > 1) {
      const first = rows[indexes[0] ?? 0];
      const hsns = new Set(indexes.map((i) => rows[i]?.hsnCode ?? ""));
      verdicts.push({
        businessKey: key,
        rowIndexes: indexes,
        classification: "LINE_ITEMS",
        explanation:
          hsns.size > 1
            ? `Invoice ${first?.invoiceNumber ?? ""} appears on ${indexes.length} rows across ${hsns.size} different HSN codes. These are separate line items of one invoice and all of them count.`
            : `Invoice ${first?.invoiceNumber ?? ""} appears on ${indexes.length} rows with differing amounts. These are separate line items of one invoice and all of them count.`,
      });
    }
  }

  // A sale and its reversal share an invoice number but not a direction. They
  // must never be collapsed — the pair is the whole point of a credit note.
  const byInvoice = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const invoice = row.invoiceNumber.trim().toLowerCase();
    if (!invoice) return;
    const bucket = byInvoice.get(invoice) ?? [];
    bucket.push(index);
    byInvoice.set(invoice, bucket);
  });

  for (const [invoice, indexes] of byInvoice) {
    if (indexes.length < 2) continue;
    const types = new Set(indexes.map((i) => rows[i]?.transactionType ?? "Sales"));
    const signs = new Set(indexes.map((i) => Math.sign(rows[i]?.taxableValue ?? 0)));
    if (types.size > 1 || signs.size > 1) {
      verdicts.push({
        businessKey: invoice,
        rowIndexes: indexes,
        classification: "SALE_AND_RETURN",
        explanation: `Invoice ${invoice} carries both a sale and a reversal. These offset each other in the net position and neither may be discarded.`,
      });
    }
  }

  return verdicts;
}

/** Row indexes that are safe to drop: exact copies, keeping the first of each. */
export function redundantRowIndexes(verdicts: DuplicateVerdict[]): Set<number> {
  const drop = new Set<number>();
  for (const verdict of verdicts) {
    if (verdict.classification !== "EXACT_DUPLICATE") continue;
    for (const index of verdict.rowIndexes.slice(1)) drop.add(index);
  }
  return drop;
}
