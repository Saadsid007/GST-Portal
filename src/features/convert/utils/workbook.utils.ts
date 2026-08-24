import * as XLSX from "xlsx";

/**
 * Recomputes a worksheet's `!ref` from the cells it actually contains.
 *
 * Some marketplace exports — Flipkart's GSTR report generator among them — ship
 * a range that does not describe the sheet. A real report arrived declaring
 * `A1:IV1`: one row tall (so every data row below the header is invisible) and
 * 256 columns wide (so header detection sees hundreds of phantom empty columns).
 * `sheet_to_json` trusts `!ref`, so the file parsed as "headers only, no data"
 * and the upload failed with nothing to import.
 *
 * Returns true when the range was widened, so callers can report the recovery
 * rather than silently changing what the file said.
 */
export function repairSheetRange(worksheet: XLSX.WorkSheet): boolean {
  const addresses = Object.keys(worksheet).filter((key) => !key.startsWith("!"));
  if (addresses.length === 0) return false;

  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  for (const address of addresses) {
    // Anything that is not a plain cell address (defined names, stray keys) is
    // skipped rather than allowed to poison the bounds.
    if (!/^[A-Z]+\d+$/.test(address)) continue;
    const cell = XLSX.utils.decode_cell(address);
    if (cell.r < minRow) minRow = cell.r;
    if (cell.r > maxRow) maxRow = cell.r;
    if (cell.c < minCol) minCol = cell.c;
    if (cell.c > maxCol) maxCol = cell.c;
  }

  if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) return false;

  const declared = worksheet["!ref"];
  const declaredRange = declared ? safeDecodeRange(declared) : null;

  // Rows are only ever widened. Shrinking them on a file that is actually fine
  // would be a way to lose data, and the defect this guards against is always an
  // under-report. Columns are snapped to the true extent in both directions:
  // an empty column carries nothing, and the padding (Flipkart declares out to
  // IV, column 255) makes header detection scan hundreds of phantom columns.
  const repaired = {
    s: {
      r: Math.min(declaredRange?.s.r ?? minRow, minRow),
      c: Math.min(declaredRange?.s.c ?? minCol, minCol),
    },
    e: {
      r: Math.max(declaredRange?.e.r ?? maxRow, maxRow),
      c: maxCol,
    },
  };

  const repairedRef = XLSX.utils.encode_range(repaired);
  if (declared === repairedRef) return false;

  worksheet["!ref"] = repairedRef;
  return true;
}

function safeDecodeRange(ref: string): XLSX.Range | null {
  try {
    return XLSX.utils.decode_range(ref);
  } catch {
    return null;
  }
}

/**
 * Reads a workbook and repairs every sheet's range before anything parses it.
 *
 * Every entry point should go through this rather than calling `XLSX.read`
 * directly — a broken range is invisible until it silently drops rows.
 */
export function readWorkbookSafely(
  buffer: Buffer,
  options: XLSX.ParsingOptions = {}
): { workbook: XLSX.WorkBook; repairedSheets: string[] } {
  const workbook = XLSX.read(buffer, { type: "buffer", ...options });
  const repairedSheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    if (repairSheetRange(worksheet)) repairedSheets.push(sheetName);
  }

  return { workbook, repairedSheets };
}

/**
 * Picks the sheet that actually holds the transaction data. Flipkart-style workbooks
 * lead with an instructional "Help" sheet, so the first sheet is not a safe default.
 */
export function extractDataRows(workbook: XLSX.WorkBook): Record<string, unknown>[] {
  let best: Record<string, unknown>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Defensive: a workbook may have been read without going through
    // readWorkbookSafely, and a bad range here costs every data row.
    repairSheetRange(worksheet);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      raw: false,
      defval: "",
    });

    if (rows.length > best.length) best = rows;
  }

  return best;
}
