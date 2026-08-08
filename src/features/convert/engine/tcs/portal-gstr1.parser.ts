import * as XLSX from "xlsx";
import { normalizeStateCode } from "@/features/convert/domain/state-codes";

export interface PortalTcsRow {
  stateCode: string; // 2-digit e.g. "06"
  taxableValue: number;
  taxAmount: number;
}

/**
 * Parses an Amazon/GST Portal GSTR-1 Excel export into a flat list of
 * (stateCode, taxableValue) pairs summed from all relevant sheets.
 *
 * The Portal GSTR-1 Excel has this structure:
 *   Row 0  → "Summary For B2CS"
 *   Row 1  → summary label row
 *   Row 2  → summary value row
 *   Row 3  → actual column header row  ← sheet_to_json must start here
 *   Row 4+ → data rows
 *
 * We handle: B2B, B2C Small, B2C Large, CDNR, CDNUR
 */
export function parsePortalGstr1(workbook: XLSX.WorkBook): PortalTcsRow[] {
  const stateMap = new Map<string, PortalTcsRow>();

  function add(stateCode: string, taxable: number, tax: number) {
    if (!stateCode) return;
    const existing = stateMap.get(stateCode) || { stateCode, taxableValue: 0, taxAmount: 0 };
    existing.taxableValue = r2(existing.taxableValue + taxable);
    existing.taxAmount = r2(existing.taxAmount + tax);
    stateMap.set(stateCode, existing);
  }

  function r2(n: number) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * Reads a sheet where the real header row is at a given offset.
   * The GSTR-1 export always has 3 rows of summary before the column header row.
   */
  function readSheet(
    sheetName: string,
    posCol: string,
    taxableCol: string,
    taxCol: string | null,
    headerOffset = 3, // number of rows to skip before the header row
    isReturn = false
  ) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    // Read as raw 2D array, then manually extract from offset
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
    }) as unknown[][];

    if (raw.length <= headerOffset) return;

    const headerRow = raw[headerOffset] as string[];
    const posIdx = headerRow.findIndex((h) => String(h).trim() === posCol);
    const taxableIdx = headerRow.findIndex((h) => String(h).trim() === taxableCol);
    const taxIdx = taxCol ? headerRow.findIndex((h) => String(h).trim() === taxCol) : -1;

    if (posIdx === -1 || taxableIdx === -1) return;

    for (let i = headerOffset + 1; i < raw.length; i++) {
      const row = raw[i] as unknown[];
      if (!row || row.length === 0) continue;

      const rawPos = String(row[posIdx] || "").trim();
      if (!rawPos) continue;

      // Place Of Supply comes as "06-Haryana" or just "06" or "06-Haryana"
      // Extract the 2-digit code before the hyphen, or normalise the name
      let stateCode = "";
      const hyphenMatch = rawPos.match(/^(\d{1,2})-/);
      if (hyphenMatch?.[1]) {
        stateCode = hyphenMatch[1].padStart(2, "0");
      } else {
        stateCode = normalizeStateCode(rawPos);
      }

      if (!stateCode) continue;

      let taxable = Number(row[taxableIdx]) || 0;
      const tax = taxIdx >= 0 ? Number(row[taxIdx]) || 0 : 0;

      // Credit notes / returns reduce taxable
      if (isReturn) taxable = -Math.abs(taxable);

      add(stateCode, taxable, tax);
    }
  }

  // ── B2B Sheet ───────────────────────────────────────────────────────────────
  readSheet("B2B", "Place Of Supply", "Taxable Value", "Cess Amount");

  // ── B2C Small (B2CS) ────────────────────────────────────────────────────────
  readSheet("B2C Small", "Place Of Supply", "Taxable Value", "Cess Amount");

  // ── B2C Large (B2CL) ────────────────────────────────────────────────────────
  readSheet("B2C Large", "Place Of Supply", "Taxable Value", "Cess Amount");

  // ── B2B Credit Notes (CDNR) — subtract ──────────────────────────────────────
  readSheet("B2B CN (cdnr)", "Place Of Supply", "Taxable Value", "Cess Amount", 3, true);

  // ── B2CL Credit Notes (CDNUR) — subtract ────────────────────────────────────
  readSheet("B2CL CN (cdnur)", "Place Of Supply", "Taxable Value", "Cess Amount", 3, true);

  return Array.from(stateMap.values());
}
