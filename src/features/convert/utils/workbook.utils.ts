import * as XLSX from "xlsx";

/**
 * Picks the sheet that actually holds the transaction data. Flipkart-style workbooks
 * lead with an instructional "Help" sheet, so the first sheet is not a safe default.
 */
export function extractDataRows(workbook: XLSX.WorkBook): Record<string, unknown>[] {
  let best: Record<string, unknown>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      raw: false,
      defval: "",
    });

    if (rows.length > best.length) best = rows;
  }

  return best;
}
