import type { ReconstructedTable } from "@/features/convert/engine/universal/types";

/**
 * The same documents handed over twice.
 *
 * Sellers hand over a folder rather than a file list, and a folder routinely
 * holds the same rows twice — the export and a copy inside a "New folder", or
 * two exports of one set of invoices under different names. Every row then
 * counts twice, which shows up as a return that is exactly double in one
 * place and reads like a tax question rather than a filing mistake.
 *
 * How much the content alone is allowed to prove depends on whether the sheet
 * names the documents it lists. See `hasDocumentIdentifier`.
 */

export interface DuplicateTable {
  fileName: string;
  sheetName: string;
  rows: number;
  reason: string;
}

/**
 * The name a file has ignoring the marks a copy picks up.
 *
 * Windows and browsers add " - Copy", " (1)" or " (2)" when a file lands
 * somewhere it already exists, so the copy is the same upload under a name
 * that differs only by that mark.
 */
function baseFileName(fileName: string): string {
  return (
    fileName
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/\s+-\s*copy(\s+\(\d+\))?$/, "")
      // The space matters: a copy is named "register (1)", whereas an invoice
      // export is named "26-27(36)" and the number in it is the document, not a
      // copy mark. Stripping it there made two different bills look like one.
      .replace(/\s+\(\d+\)$/, "")
      .trim()
  );
}

/** Header words that name the column identifying a document. */
const IDENTIFIER_HEADER =
  /\b(invoice|document|bill|challan|note|order)\s*(number|no\.?|id|#)\b|^(inum|nt_num|invoice)$/i;

/**
 * Whether the sheet names the documents it lists.
 *
 * A sheet carrying invoice numbers that repeats another's rows exactly is the
 * same set of documents read twice, whatever the two files are called — a
 * seller exports "GST_Extracted_Invoices" and "B2B_Invoices_Summary" from one
 * set of PDFs and hands over both.
 *
 * A sheet without them proves far less: an invoice printout keeps its number
 * in a merged heading rather than in a column, so two different bills for the
 * same goods and quantity reduce to identical rows. There the file name has to
 * agree too, or a real sale would be dropped.
 */
function hasDocumentIdentifier(table: ReconstructedTable): boolean {
  return table.headers.some((header) => IDENTIFIER_HEADER.test(header.trim()));
}

function tableSignature(table: ReconstructedTable): string {
  // Cell order within a row is fixed by the header order, so the two together
  // identify the sheet's content. Comparing the source files byte for byte
  // would not work: the same sheet saved twice by Excel is not identical.
  const header = table.headers.map((h) => h.trim().toLowerCase()).join("");
  const body = table.rows
    .map((row) => table.headers.map((h) => String(row[h] ?? "").trim()).join(""))
    .join("");
  return `${header}${body}`;
}

/**
 * Marks every upload after the first that repeats content already seen.
 *
 * Keyed by the table's position in the batch, because two copies of one export
 * share a file name and a sheet name — that is the whole point of them.
 *
 * The first occurrence is kept and the rest are reported, so the user is told
 * a copy was set aside rather than left wondering why a total moved.
 */
export function detectDuplicateTables(
  tables: { fileName: string; table: ReconstructedTable }[]
): Map<number, DuplicateTable> {
  const firstSeen = new Map<string, string>();
  const duplicates = new Map<number, DuplicateTable>();

  tables.forEach(({ fileName, table }, index) => {
    // An empty sheet carries nothing to count twice, and the blank tabs of a
    // template would otherwise all look like copies of one another.
    if (table.rows.length === 0) return;

    const signature = tableSignature(table);
    const key = hasDocumentIdentifier(table)
      ? signature
      : `${baseFileName(fileName)}${table.sheetName.trim().toLowerCase()}${signature}`;

    const original = firstSeen.get(key);
    if (original === undefined) {
      firstSeen.set(key, fileName);
      return;
    }

    const sameFile = original === fileName;
    duplicates.set(index, {
      fileName,
      sheetName: table.sheetName,
      rows: table.rows.length,
      reason: sameFile
        ? `A second copy of ${fileName} was uploaded with the same contents. Reading it again would count these ${table.rows.length} rows twice.`
        : `These ${table.rows.length} rows are the same documents already read from ${original}. Reading them again would count each one twice.`,
    });
  });

  return duplicates;
}
