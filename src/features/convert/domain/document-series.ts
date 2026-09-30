import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Table 13 — the document series the taxpayer issued during the period.
 *
 * Shared by both generators. They had grown separate implementations of this,
 * which meant the Excel and the JSON of one return could disagree about the
 * seller's own books: the Excel folded marketplace references into a single
 * block, the JSON enumerated them, and only one of the two applied any test of
 * whether a "series" was a series at all.
 */

/** One entry of Table 13. */
export interface DocumentSeries {
  documentType: "Invoices for outward supply" | "Debit Note" | "Credit Note";
  from: string;
  to: string;
  totalNumber: number;
  cancelled: number;
}

const DOC_TYPE_ORDER: DocumentSeries["documentType"][] = [
  "Invoices for outward supply",
  "Debit Note",
  "Credit Note",
];

/**
 * The serial a document type carries in the statutory "Nature of Document"
 * list of Table 13. These are fixed by the return format, not chosen by us:
 * 4 is the Debit Note and 5 is the Credit Note, and the JSON generator had
 * been filing credit notes under 4 — declaring them as debit notes.
 */
const DOC_TYPE_SERIAL: Record<DocumentSeries["documentType"], number> = {
  "Invoices for outward supply": 1,
  "Debit Note": 4,
  "Credit Note": 5,
};

export function documentTypeSerial(documentType: DocumentSeries["documentType"]): number {
  return DOC_TYPE_SERIAL[documentType];
}

/**
 * The stem an invoice number belongs to.
 *
 * "IN-1024" and "IN-707" share "IN-"; "2026-2027/57" gives "2026-2027/".
 * Table 13 wants one row per series with its own range, and mixing series
 * produced a range spanning two unrelated books.
 */
export function documentSeriesStem(invoiceNumber: string): string {
  return invoiceNumber.replace(/\d+\s*$/, "") || "#";
}

/**
 * Whether a stem names a series the taxpayer actually keeps.
 *
 * A marketplace order reference is a long unbroken run of digits — fourteen of
 * them in a Meesho export — while a real stem is short and punctuated: "IN-",
 * "CN-", "2026-2027/". Counting documents is not enough on its own: one order
 * split across two shipments shares a stem and would otherwise pass as a
 * two-document series.
 */
export function isRealSeries(stem: string, documentCount: number): boolean {
  const longestDigitRun = Math.max(0, ...(stem.match(/\d+/g) ?? []).map((run) => run.length));
  if (longestDigitRun >= 10) return false;

  return documentCount > 1 || /[A-Za-z]/.test(stem);
}

/**
 * Builds Table 13 from the rows, listing only series the seller issued.
 *
 * Marketplace order references are left out entirely rather than reported as a
 * block. The range they produce — "00038883474816_1" to "99947360054592_1"
 * across 525 documents — is the smallest and largest of a sorted list of order
 * numbers and describes no book that exists. Every filed return in the corpus
 * omits them and lists only the seller's own series, because the marketplace
 * issues and reports its own documents.
 *
 * Where the real invoice numbers are known — Meesho's tax invoice details
 * sheet supplies them, and the import applies it — those rows form a genuine
 * series and are reported normally.
 */
export function buildDocumentSeries(rows: NormalizedInvoiceRow[]): DocumentSeries[] {
  const groups = new Map<
    string,
    { documentType: DocumentSeries["documentType"]; nums: Set<string> }
  >();

  for (const row of rows) {
    const number = row.invoiceNumber.trim();
    if (!number) continue;

    // A debit note raises an earlier supply rather than making a new one, so
    // counting it among the invoices put a marketplace's note series into the
    // seller's own book.
    const documentType: DocumentSeries["documentType"] = row.isDebitNote
      ? "Debit Note"
      : row.invoiceType === "CDNR" || row.invoiceType === "CDNCS"
        ? "Credit Note"
        : "Invoices for outward supply";

    const stem = documentSeriesStem(number);
    // Keyed on an object rather than a joined string: "Credit Note" contains a
    // space, and splitting a composite key on one put the document type's
    // second word into the series stem.
    const key = `${documentType}\0${stem}`;
    const group = groups.get(key) ?? { documentType, nums: new Set<string>() };
    group.nums.add(number);
    groups.set(key, group);
  }

  const series: DocumentSeries[] = [];

  for (const [key, group] of groups) {
    const stem = key.slice(key.indexOf("\0") + 1);
    if (!isRealSeries(stem, group.nums.size)) continue;

    const sorted = [...group.nums].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    series.push({
      documentType: group.documentType,
      from: sorted[0]!,
      to: sorted[sorted.length - 1]!,
      totalNumber: sorted.length,
      // Cancellations are not derivable from a marketplace export — a
      // cancelled invoice simply never appears in it. Reporting 0 states what
      // is known rather than implying the books were checked.
      cancelled: 0,
    });
  }

  // Invoices before credit notes, the order Table 13 is read in and the one
  // the filed returns use. Sorting by name alone would put credit notes first.
  series.sort(
    (a, b) =>
      DOC_TYPE_ORDER.indexOf(a.documentType) - DOC_TYPE_ORDER.indexOf(b.documentType) ||
      a.from.localeCompare(b.from, undefined, { numeric: true })
  );

  return series;
}

/**
 * Documents left out of Table 13 because they carry no series of their own.
 *
 * Returned so the import can say so. A seller looking at a Table 13 that lists
 * eleven invoices, having sold six hundred items, needs to be told why rather
 * than left to wonder.
 */
export function countUnseriesedDocuments(rows: NormalizedInvoiceRow[]): number {
  // Whether a stem is a real series depends on how many documents share it, so
  // the answer comes from the series actually built rather than from testing
  // each number on its own.
  const reportedStems = new Set(buildDocumentSeries(rows).map((s) => documentSeriesStem(s.from)));

  const unreported = new Set<string>();
  for (const row of rows) {
    const number = row.invoiceNumber.trim();
    if (!number) continue;
    if (!reportedStems.has(documentSeriesStem(number))) unreported.add(number);
  }

  return unreported.size;
}
