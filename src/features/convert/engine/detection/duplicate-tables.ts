import type { ReconstructedTable } from "@/features/convert/engine/universal/types";

/**
 * The same upload handed over twice.
 *
 * Sellers hand over a folder rather than a file list, and a folder routinely
 * holds the same workbook twice — the export and a copy inside a "New folder",
 * or the same register downloaded again. Every row then counts twice, which
 * shows up as a return that is exactly double in one place and reads like a
 * tax question rather than a filing mistake.
 *
 * Identical content is not on its own enough to call something a copy. An
 * invoice printout carries its number in a merged heading rather than in a
 * column, so two different invoices for the same goods and quantity reduce to
 * the same table — and dropping one of those would lose a real sale. The file
 * name has to agree as well, which is what an accidental second copy always
 * has and two genuinely different documents never do.
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

function tableSignature(table: ReconstructedTable): string {
  // Cell order within a row is fixed by the header order, so the two together
  // identify the sheet's content. Comparing the source files byte for byte
  // would not work: the same sheet saved twice by Excel is not identical.
  const header = table.headers.map((h) => h.trim().toLowerCase()).join("");
  const body = table.rows
    .map((row) => table.headers.map((h) => String(row[h] ?? "").trim()).join(""))
    .join("");
  return `${header}${body}`;
}

/**
 * Marks every upload after the first that repeats content already seen under
 * the same name. Keyed by the table's position in the batch, because the two
 * copies share a file name and a sheet name — that is the whole point of them.
 *
 * The first occurrence is kept and the rest are reported, so the user is told
 * a copy was set aside rather than left wondering why a total moved.
 */
export function detectDuplicateTables(
  tables: { fileName: string; table: ReconstructedTable }[]
): Map<number, DuplicateTable> {
  const firstSeen = new Set<string>();
  const duplicates = new Map<number, DuplicateTable>();

  tables.forEach(({ fileName, table }, index) => {
    // An empty sheet carries nothing to count twice, and the blank tabs of a
    // template would otherwise all look like copies of one another.
    if (table.rows.length === 0) return;

    const key = `${baseFileName(fileName)}${table.sheetName.trim().toLowerCase()}${tableSignature(table)}`;

    if (!firstSeen.has(key)) {
      firstSeen.add(key);
      return;
    }

    duplicates.set(index, {
      fileName,
      sheetName: table.sheetName,
      rows: table.rows.length,
      reason: `A second copy of ${fileName} was uploaded with the same contents. Reading it again would count these ${table.rows.length} rows twice.`,
    });
  });

  return duplicates;
}
