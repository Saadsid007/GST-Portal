import * as XLSX from "xlsx";
import type { DiscardedRegion, ReconstructedTable } from "./types";
import { looksNumeric } from "./signals";

/**
 * Layer 1 — universal file reader.
 *
 * Reconstructs the logical table before anything tries to parse it. Real
 * marketplace and ERP exports are not clean grids: they open with a title and a
 * date range, split the header across two rows, repeat the header every N rows,
 * and close with a totals band. Reading such a sheet with `sheet_to_json` and
 * trusting row 0 as the header produces a table whose every column is named
 * "__EMPTY_3" — which then maps to nothing.
 *
 * Nothing here knows which marketplace produced the file.
 */

/** Rows scanned when looking for the header. Headers are never deep in a file. */
const HEADER_SEARCH_DEPTH = 30;

/** Words that mark a summary or totals band rather than a transaction. */
const TOTAL_MARKERS = [
  "grand total",
  "total",
  "subtotal",
  "sub total",
  "sum of",
  "net total",
  "closing balance",
  "opening balance",
];

/** Words that make a cell look like a column label rather than a value. */
const HEADER_WORD_HINTS = [
  "invoice",
  "order",
  "date",
  "gstin",
  "gst",
  "tax",
  "taxable",
  "amount",
  "value",
  "rate",
  "hsn",
  "sac",
  "qty",
  "quantity",
  "state",
  "supply",
  "buyer",
  "customer",
  "name",
  "sku",
  "item",
  "product",
  "cgst",
  "sgst",
  "igst",
  "cess",
  "total",
  "shipment",
  "return",
  "credit",
  "note",
  "unit",
  "price",
];

type Matrix = string[][];

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell === "");
}

function filledCount(row: string[]): number {
  return row.reduce((n, cell) => (cell === "" ? n : n + 1), 0);
}

/**
 * Scores a row on how much it reads like a header: mostly text, mostly filled,
 * distinct labels, and vocabulary that belongs to column names.
 */
function scoreAsHeader(row: string[], following: Matrix): number {
  const filled = filledCount(row);
  if (filled < 2) return 0;

  const values = row.filter((c) => c !== "");
  const numeric = values.filter((c) => looksNumeric(c)).length / values.length;
  const distinct = new Set(values.map((v) => v.toLowerCase())).size / values.length;
  const vocabulary =
    values.filter((v) => {
      const lower = v.toLowerCase();
      return HEADER_WORD_HINTS.some((w) => lower.includes(w));
    }).length / values.length;

  // A header is followed by rows of comparable width. A stray title row is not.
  const body = following.slice(0, 5).filter((r) => !isBlankRow(r));
  const widthAgreement =
    body.length === 0
      ? 0
      : body.filter((r) => Math.abs(filledCount(r) - filled) <= Math.max(2, filled * 0.4)).length /
        body.length;

  // Bodies are more numeric than their headers; that contrast is the strongest
  // single signal that this row labels the rows beneath it.
  const bodyValues = body.flat().filter((c) => c !== "");
  const bodyNumeric =
    bodyValues.length === 0
      ? 0
      : bodyValues.filter((c) => looksNumeric(c)).length / bodyValues.length;
  const contrast = Math.max(0, bodyNumeric - numeric);

  return (1 - numeric) * 25 + distinct * 15 + vocabulary * 30 + widthAgreement * 15 + contrast * 15;
}

/**
 * Merges a header spread over two rows ("Tax" over "IGST" / "CGST") into one
 * label per column, carrying a merged parent cell rightwards the way a reader
 * would.
 */
function mergeHeaderRows(rows: Matrix, width: number): string[] {
  const merged: string[] = [];
  for (let col = 0; col < width; col++) {
    const parts: string[] = [];
    let carried = "";
    for (const row of rows) {
      const cell = row[col] ?? "";
      // Merged cells leave the continuation columns empty in the sheet.
      if (cell !== "") carried = cell;
      const effective = cell !== "" ? cell : row === rows[0] ? carried : "";
      if (effective && !parts.includes(effective)) parts.push(effective);
    }
    merged.push(parts.join(" ").trim());
  }
  return merged;
}

/** How many rows starting at `index` form one header block. */
function headerSpan(matrix: Matrix, index: number, width: number): number {
  const next = matrix[index + 1];
  if (!next) return 1;

  const nextValues = next.filter((c) => c !== "");
  if (nextValues.length === 0) return 1;

  const nextNumeric = nextValues.filter((c) => looksNumeric(c)).length / nextValues.length;
  // A second header row is still textual and still sparse relative to the data.
  const looksTextual = nextNumeric < 0.15;
  const sparse = filledCount(next) < width * 0.75;
  const hasVocabulary = nextValues.some((v) =>
    HEADER_WORD_HINTS.some((w) => v.toLowerCase().includes(w))
  );

  return looksTextual && (sparse || hasVocabulary) ? 2 : 1;
}

/** Disambiguates blank and repeated labels so every column is addressable. */
function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((label, index) => {
    const base = label === "" ? `Column ${index + 1}` : label;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function isTotalsRow(row: string[], filledColumns: number): boolean {
  const values = row.filter((c) => c !== "");
  if (values.length === 0) return false;

  const marked = values.some((v) => {
    const lower = v.toLowerCase();
    return TOTAL_MARKERS.some(
      (m) => lower === m || lower.startsWith(`${m} `) || lower.endsWith(` ${m}`)
    );
  });
  if (!marked) return false;

  // A totals band is mostly numbers with one label; a transaction that merely
  // mentions "total" in a product name is not.
  const numeric = values.filter((v) => looksNumeric(v)).length;
  return numeric >= 1 && values.length <= Math.max(3, filledColumns * 0.6);
}

/**
 * Rebuilds one worksheet into a logical table, dropping preamble, repeated
 * headers, totals bands and trailing notes, and recording why each was dropped.
 */
export function reconstructSheet(sheetName: string, worksheet: XLSX.WorkSheet): ReconstructedTable {
  const matrix: Matrix = XLSX.utils
    .sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: "", blankrows: true })
    .map((row) => (Array.isArray(row) ? row.map(cellText) : []));

  const discarded: DiscardedRegion[] = [];
  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);

  if (width === 0 || matrix.length === 0) {
    return {
      sheetName,
      headers: [],
      rows: [],
      headerRowIndex: -1,
      headerRowSpan: 0,
      discarded,
      score: 0,
    };
  }

  const padded: Matrix = matrix.map((row) => {
    const copy = row.slice(0, width);
    while (copy.length < width) copy.push("");
    return copy;
  });

  // Find the header by scoring candidates rather than assuming row 0.
  let headerRowIndex: number = -1;
  let headerScore = 0;
  const depth = Math.min(HEADER_SEARCH_DEPTH, padded.length);
  for (let i = 0; i < depth; i++) {
    const row = padded[i];
    if (!row || isBlankRow(row)) continue;
    const score = scoreAsHeader(row, padded.slice(i + 1));
    if (score > headerScore) {
      headerScore = score;
      headerRowIndex = i;
    }
  }

  if (headerRowIndex === -1) {
    return {
      sheetName,
      headers: [],
      rows: [],
      headerRowIndex: -1,
      headerRowSpan: 0,
      discarded,
      score: 0,
    };
  }

  // A banded header ("Tax" spanning IGST and Cess) puts the specific labels on
  // the lower row, which scores higher because it is denser. Scoring alone
  // therefore selects the lower row and throws the band away. Reach back up when
  // the row above is a sparse textual band rather than a title or a data row.
  if (headerRowIndex > 0) {
    const above = padded[headerRowIndex - 1];
    const chosen = padded[headerRowIndex];
    if (above && chosen && !isBlankRow(above)) {
      const aboveValues = above.filter((c) => c !== "");
      const aboveNumeric =
        aboveValues.filter((c) => looksNumeric(c)).length / Math.max(1, aboveValues.length);
      const sparser = filledCount(above) < filledCount(chosen);
      const notATitle = filledCount(above) >= 2;
      if (aboveNumeric === 0 && sparser && notATitle) headerRowIndex -= 1;
    }
  }

  for (let i = 0; i < headerRowIndex; i++) {
    const row = padded[i];
    if (!row) continue;
    discarded.push({
      kind: isBlankRow(row) ? "BLANK" : "PREAMBLE",
      rowIndex: i,
      reason: isBlankRow(row)
        ? "Blank row above the header"
        : `Preamble above the detected header: "${row.filter(Boolean).slice(0, 3).join(" | ")}"`,
    });
  }

  const span = headerSpan(padded, headerRowIndex, width);
  const headerBlock = padded.slice(headerRowIndex, headerRowIndex + span);
  const headers = uniqueHeaders(mergeHeaderRows(headerBlock, width));
  const headerFingerprint = headers.map((h) => h.toLowerCase()).join("|");
  const headerWidth = filledCount(headerBlock[0] ?? []);

  const rows: Record<string, string>[] = [];
  for (let i = headerRowIndex + span; i < padded.length; i++) {
    const row = padded[i];
    if (!row) continue;

    if (isBlankRow(row)) {
      discarded.push({ kind: "BLANK", rowIndex: i, reason: "Blank row inside the data region" });
      continue;
    }

    if (row.map((c) => c.toLowerCase()).join("|") === headerFingerprint) {
      discarded.push({
        kind: "REPEATED_HEADER",
        rowIndex: i,
        reason: "Header repeated mid-sheet, typically a page break",
      });
      continue;
    }

    if (isTotalsRow(row, headerWidth)) {
      discarded.push({
        kind: "TOTALS",
        rowIndex: i,
        reason: `Summary band: "${row.find((c) => c !== "") ?? ""}"`,
      });
      continue;
    }

    // A trailing note ("* figures are provisional") occupies one or two cells
    // in a table that is otherwise many columns wide.
    if (headerWidth >= 4 && filledCount(row) <= 1) {
      discarded.push({
        kind: "FOOTER",
        rowIndex: i,
        reason: "Single-cell row in a wide table, read as a note rather than a transaction",
      });
      continue;
    }

    const record: Record<string, string> = {};
    headers.forEach((header, col) => {
      record[header] = row[col] ?? "";
    });
    rows.push(record);
  }

  return {
    sheetName,
    headers,
    rows,
    headerRowIndex,
    headerRowSpan: span,
    discarded,
    score: headerScore,
  };
}

/**
 * Picks the sheet that actually holds transactions.
 *
 * Row count alone is the wrong test: a "Read me" sheet can be longer than a
 * short month's sales. The header score is weighed alongside size so a
 * well-formed table beats a long prose sheet.
 */
export function reconstructWorkbook(workbook: XLSX.WorkBook): ReconstructedTable[] {
  const tables: ReconstructedTable[] = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const table = reconstructSheet(sheetName, worksheet);
    if (table.rows.length > 0 && table.headers.length >= 2) tables.push(table);
  }

  return tables.sort((a, b) => rank(b) - rank(a));
}

function rank(table: ReconstructedTable): number {
  // Log-scaled so a 50,000-row sheet does not swamp the structural signal, and
  // width counts because transaction tables are wide.
  return table.score + Math.log10(table.rows.length + 1) * 20 + Math.min(table.headers.length, 30);
}
