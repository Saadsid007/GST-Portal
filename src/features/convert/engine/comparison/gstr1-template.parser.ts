import * as XLSX from "xlsx";
import { readWorkbookSafely } from "@/features/convert/utils/workbook.utils";
import { normalizeStateCode } from "@/features/convert/domain/state-codes";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TemplateB2bInvoice {
  buyerGstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string; // 2-digit state code
  reverseCharge: boolean;
  invoiceType: string; // "Regular B2B", "SEWOP", etc.
  ecoGstin: string;
  rate: number;
  taxableValue: number;
  cessAmount: number;
}

export interface TemplateB2csRow {
  type: string; // "OE" = E-Commerce, "OS" = Normal
  placeOfSupply: string;
  rate: number;
  taxableValue: number;
  cessAmount: number;
  ecoGstin: string;
}

export interface TemplateB2clInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  rate: number;
  taxableValue: number;
  cessAmount: number;
  ecoGstin: string;
}

export interface TemplateCdnrEntry {
  buyerGstin: string;
  noteNumber: string;
  noteDate: string;
  noteType: "C" | "D"; // C = Credit, D = Debit
  placeOfSupply: string;
  reverseCharge: boolean;
  noteSupplyType: string;
  noteValue: number;
  rate: number;
  taxableValue: number;
  cessAmount: number;
}

export interface TemplateCdnurEntry {
  urType: string;
  noteNumber: string;
  noteDate: string;
  noteType: "C" | "D";
  placeOfSupply: string;
  noteValue: number;
  rate: number;
  taxableValue: number;
  cessAmount: number;
}

export interface ParsedGstr1Template {
  sourceType: "amazon_gstr1" | "govt_template" | "unknown";
  b2b: TemplateB2bInvoice[];
  b2cs: TemplateB2csRow[];
  b2cl: TemplateB2clInvoice[];
  cdnr: TemplateCdnrEntry[];
  cdnur: TemplateCdnurEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function extractStateCode(raw: string): string {
  if (!raw) return "";
  // "06-Haryana" or "06" or "Haryana"
  const m = raw.match(/^(\d{1,2})-/);
  if (m?.[1]) return m[1].padStart(2, "0");
  if (/^\d{1,2}$/.test(raw.trim())) return raw.trim().padStart(2, "0");
  return normalizeStateCode(raw);
}

function parseRate(val: unknown): number {
  let r = Number(val) || 0;
  if (r > 0 && r <= 1) r *= 100;
  return r2(r);
}

/**
 * Read a sheet skipping N header rows (summary rows before actual column header).
 * Returns { headers, rows } where rows are keyed by the actual header values.
 */
function readSheetWithOffset(
  workbook: XLSX.WorkBook,
  sheetName: string,
  headerRowIndex: number
): Record<string, unknown>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  if (raw.length <= headerRowIndex) return [];

  const headers = (raw[headerRowIndex] as string[]).map((h) => String(h ?? "").trim());
  const result: Record<string, unknown>[] = [];

  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const rowArr = raw[i] as unknown[];
    // Skip entirely empty rows
    if (!rowArr || rowArr.every((c) => c === "" || c === null || c === undefined)) continue;

    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = rowArr[idx] ?? "";
    });
    result.push(obj);
  }

  return result;
}

// ── Amazon GSTR-1 Parser (3-row summary header offset) ───────────────────────

function parseAmazonGstr1(workbook: XLSX.WorkBook): ParsedGstr1Template {
  const HEADER_OFFSET = 3;

  // B2B
  const b2b: TemplateB2bInvoice[] = readSheetWithOffset(workbook, "B2B", HEADER_OFFSET)
    .filter((r) => r["Invoice Number"])
    .map((r) => ({
      buyerGstin: String(r["GSTIN/UIN of Recipient"] || "").trim(),
      invoiceNumber: String(r["Invoice Number"] || "").trim(),
      invoiceDate: String(r["Invoice date"] || r["Invoice Date"] || "").trim(),
      invoiceValue: r2(Number(r["Invoice Value"]) || 0),
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      reverseCharge: String(r["Reverse Charge"] || "").toUpperCase() === "Y",
      invoiceType: String(r["Invoice Type"] || "Regular B2B"),
      ecoGstin: String(r["E-Commerce GSTIN"] || "").trim(),
      rate: parseRate(r["Rate"]),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
    }));

  // B2CS (B2C Small)
  const b2cs: TemplateB2csRow[] = readSheetWithOffset(workbook, "B2C Small", HEADER_OFFSET)
    .filter((r) => r["Place Of Supply"])
    .map((r) => ({
      type: String(r["Type"] || "E"),
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      rate: parseRate(r["Rate"]),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
      ecoGstin: String(r["E-Commerce GSTIN"] || "").trim(),
    }));

  // B2CL (B2C Large)
  const b2cl: TemplateB2clInvoice[] = readSheetWithOffset(workbook, "B2C Large", HEADER_OFFSET)
    .filter((r) => r["Invoice Number"])
    .map((r) => ({
      invoiceNumber: String(r["Invoice Number"] || "").trim(),
      invoiceDate: String(r["Invoice date"] || "").trim(),
      invoiceValue: r2(Number(r["Invoice Value"]) || 0),
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      rate: parseRate(r["Rate"]),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
      ecoGstin: String(r["E-Commerce GSTIN"] || "").trim(),
    }));

  // CDNR (B2B Credit Notes)
  const cdnr: TemplateCdnrEntry[] = readSheetWithOffset(workbook, "B2B CN (cdnr)", HEADER_OFFSET)
    .filter((r) => r["Note Number"])
    .map((r) => ({
      buyerGstin: String(r["GSTIN/UIN of Recipient"] || "").trim(),
      noteNumber: String(r["Note Number"] || "").trim(),
      noteDate: String(r["Note Date"] || "").trim(),
      noteType: String(r["Note Type"] || "C").toUpperCase() === "D" ? "D" : "C",
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      reverseCharge: String(r["Reverse Charge"] || "").toUpperCase() === "Y",
      noteSupplyType: String(r["Note Supply Type"] || "Regular B2B"),
      noteValue: r2(Number(r["Note Value"]) || 0),
      rate: parseRate(r["Rate"]),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
    }));

  // CDNUR (B2C Credit Notes)
  const cdnur: TemplateCdnurEntry[] = readSheetWithOffset(
    workbook,
    "B2CL CN (cdnur)",
    HEADER_OFFSET
  )
    .filter((r) => r["Note Number"])
    .map((r) => ({
      urType: String(r["UR Type"] || "").trim(),
      noteNumber: String(r["Note Number"] || "").trim(),
      noteDate: String(r["Note Date"] || "").trim(),
      noteType: String(r["Note Type"] || "C").toUpperCase() === "D" ? "D" : "C",
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      noteValue: r2(Number(r["Note Value"]) || 0),
      rate: r2(Number(r["Rate"]) || 0),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
    }));

  return { sourceType: "amazon_gstr1", b2b, b2cs, b2cl, cdnr, cdnur };
}

// ── Govt GSTR-1 Template Parser (V2.1 format) ────────────────────────────────

function parseGovtTemplate(workbook: XLSX.WorkBook): ParsedGstr1Template {
  const HEADER_OFFSET = 3;

  // B2B (sheet: "b2b,sez,de")
  const b2bSheet =
    workbook.SheetNames.find(
      (s) => s.toLowerCase().startsWith("b2b") && !s.toLowerCase().includes("cn")
    ) ?? "b2b,sez,de";

  const b2b: TemplateB2bInvoice[] = readSheetWithOffset(workbook, b2bSheet, HEADER_OFFSET)
    .filter((r) => r["Invoice Number"])
    .map((r) => ({
      buyerGstin: String(r["GSTIN/UIN of Recipient"] || "").trim(),
      invoiceNumber: String(r["Invoice Number"] || "").trim(),
      invoiceDate: String(r["Invoice date"] || r["Invoice Date"] || "").trim(),
      invoiceValue: r2(Number(r["Invoice Value"]) || 0),
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      reverseCharge: String(r["Reverse Charge"] || "").toUpperCase() === "Y",
      invoiceType: String(r["Invoice Type"] || "Regular B2B"),
      ecoGstin: String(r["E-Commerce GSTIN"] || "").trim(),
      rate: parseRate(r["Rate"]),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
    }));

  // B2CS (sheet: "b2cs")
  const b2cs: TemplateB2csRow[] = readSheetWithOffset(workbook, "b2cs", HEADER_OFFSET)
    .filter((r) => r["Place Of Supply"])
    .map((r) => ({
      type: String(r["Type"] || "OE"),
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      rate: parseRate(r["Rate"]),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
      ecoGstin: String(r["E-Commerce GSTIN"] || "").trim(),
    }));

  // B2CL (sheet: "b2cl")
  const b2cl: TemplateB2clInvoice[] = readSheetWithOffset(workbook, "b2cl", HEADER_OFFSET)
    .filter((r) => r["Invoice Number"])
    .map((r) => ({
      invoiceNumber: String(r["Invoice Number"] || "").trim(),
      invoiceDate: String(r["Invoice date"] || "").trim(),
      invoiceValue: r2(Number(r["Invoice Value"]) || 0),
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      rate: parseRate(r["Rate"]),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
      ecoGstin: String(r["E-Commerce GSTIN"] || "").trim(),
    }));

  // CDNR (sheet: "cdnr")
  const cdnr: TemplateCdnrEntry[] = readSheetWithOffset(workbook, "cdnr", HEADER_OFFSET)
    .filter((r) => r["Note Number"])
    .map((r) => ({
      buyerGstin: String(r["GSTIN/UIN of Recipient"] || "").trim(),
      noteNumber: String(r["Note Number"] || "").trim(),
      noteDate: String(r["Note Date"] || "").trim(),
      noteType: String(r["Note Type"] || "C").toUpperCase() === "D" ? "D" : "C",
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      reverseCharge: String(r["Reverse Charge"] || "").toUpperCase() === "Y",
      noteSupplyType: String(r["Note Supply Type"] || "Regular B2B"),
      noteValue: r2(Number(r["Note Value"]) || 0),
      rate: parseRate(r["Rate"]),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
    }));

  // CDNUR (sheet: "cdnur")
  const cdnur: TemplateCdnurEntry[] = readSheetWithOffset(workbook, "cdnur", HEADER_OFFSET)
    .filter((r) => r["Note Number"])
    .map((r) => ({
      urType: String(r["UR Type"] || "").trim(),
      noteNumber: String(r["Note Number"] || "").trim(),
      noteDate: String(r["Note Date"] || "").trim(),
      noteType: String(r["Note Type"] || "C").toUpperCase() === "D" ? "D" : "C",
      placeOfSupply: extractStateCode(String(r["Place Of Supply"] || "")),
      noteValue: r2(Number(r["Note Value"]) || 0),
      rate: parseRate(r["Rate"]),
      taxableValue: r2(Number(r["Taxable Value"]) || 0),
      cessAmount: r2(Number(r["Cess Amount"]) || 0),
    }));

  return { sourceType: "govt_template", b2b, b2cs, b2cl, cdnr, cdnur };
}

// ── GSTR-1 JSON Parser ────────────────────────────────────────────────────────

export function parseGstr1Json(jsonStr: string): ParsedGstr1Template {
  try {
    const data = JSON.parse(jsonStr);

    const b2b: TemplateB2bInvoice[] = [];
    if (Array.isArray(data.b2b)) {
      for (const item of data.b2b) {
        const buyerGstin = String(item.ctin || "").trim();
        if (Array.isArray(item.inv)) {
          for (const inv of item.inv) {
            const inum = String(inv.inum || "").trim();
            const idt = String(inv.idt || "").trim();
            const val = r2(Number(inv.val) || 0);
            const pos = extractStateCode(String(inv.pos || ""));
            const rchrg = String(inv.rchrg || "").toUpperCase() === "Y";
            const invType = String(inv.inv_typ || "Regular B2B");
            const ecoGstin = String(inv.etin || "").trim();

            if (Array.isArray(inv.itms)) {
              for (const itm of inv.itms) {
                const itmDet = itm.itm_det || itm;
                b2b.push({
                  buyerGstin,
                  invoiceNumber: inum,
                  invoiceDate: idt,
                  invoiceValue: val,
                  placeOfSupply: pos,
                  reverseCharge: rchrg,
                  invoiceType: invType,
                  ecoGstin,
                  rate: parseRate(itmDet.rt),
                  taxableValue: r2(Number(itmDet.txval) || 0),
                  cessAmount: r2(Number(itmDet.csamt) || 0),
                });
              }
            }
          }
        }
      }
    }

    const b2cs: TemplateB2csRow[] = [];
    if (Array.isArray(data.b2cs)) {
      for (const item of data.b2cs) {
        b2cs.push({
          type: String(item.typ || "OE"),
          placeOfSupply: extractStateCode(String(item.pos || "")),
          rate: parseRate(item.rt),
          taxableValue: r2(Number(item.txval) || 0),
          cessAmount: r2(Number(item.csamt) || 0),
          ecoGstin: String(item.etin || "").trim(),
        });
      }
    }

    const b2cl: TemplateB2clInvoice[] = [];
    if (Array.isArray(data.b2cl)) {
      for (const group of data.b2cl) {
        const pos = extractStateCode(String(group.pos || ""));
        if (Array.isArray(group.inv)) {
          for (const inv of group.inv) {
            const inum = String(inv.inum || "").trim();
            const idt = String(inv.idt || "").trim();
            const val = r2(Number(inv.val) || 0);
            const ecoGstin = String(inv.etin || "").trim();
            if (Array.isArray(inv.itms)) {
              for (const itm of inv.itms) {
                const itmDet = itm.itm_det || itm;
                b2cl.push({
                  invoiceNumber: inum,
                  invoiceDate: idt,
                  invoiceValue: val,
                  placeOfSupply: pos,
                  rate: parseRate(itmDet.rt),
                  taxableValue: r2(Number(itmDet.txval) || 0),
                  cessAmount: r2(Number(itmDet.csamt) || 0),
                  ecoGstin,
                });
              }
            }
          }
        }
      }
    }

    const cdnr: TemplateCdnrEntry[] = [];
    if (Array.isArray(data.cdnr)) {
      for (const item of data.cdnr) {
        const buyerGstin = String(item.ctin || "").trim();
        if (Array.isArray(item.nt)) {
          for (const nt of item.nt) {
            const noteNumber = String(nt.nt_num || "").trim();
            const noteDate = String(nt.nt_dt || "").trim();
            const noteType = String(nt.ntty || "C").toUpperCase() === "D" ? "D" : "C";
            const pos = extractStateCode(String(nt.pos || ""));
            const rchrg = String(nt.rchrg || "").toUpperCase() === "Y";
            const noteSupplyType = String(nt.typ || "Regular B2B");
            const noteValue = r2(Number(nt.val) || 0);
            if (Array.isArray(nt.itms)) {
              for (const itm of nt.itms) {
                const itmDet = itm.itm_det || itm;
                cdnr.push({
                  buyerGstin,
                  noteNumber,
                  noteDate,
                  noteType,
                  placeOfSupply: pos,
                  reverseCharge: rchrg,
                  noteSupplyType,
                  noteValue,
                  rate: parseRate(itmDet.rt),
                  taxableValue: r2(Number(itmDet.txval) || 0),
                  cessAmount: r2(Number(itmDet.csamt) || 0),
                });
              }
            }
          }
        }
      }
    }

    const cdnur: TemplateCdnurEntry[] = [];
    if (Array.isArray(data.cdnur)) {
      for (const nt of data.cdnur) {
        const noteNumber = String(nt.nt_num || "").trim();
        const noteDate = String(nt.nt_dt || "").trim();
        const noteType = String(nt.ntty || "C").toUpperCase() === "D" ? "D" : "C";
        const pos = extractStateCode(String(nt.pos || ""));
        const urType = String(nt.typ || "").trim();
        const noteValue = r2(Number(nt.val) || 0);
        if (Array.isArray(nt.itms)) {
          for (const itm of nt.itms) {
            const itmDet = itm.itm_det || itm;
            cdnur.push({
              urType,
              noteNumber,
              noteDate,
              noteType,
              placeOfSupply: pos,
              noteValue,
              rate: parseRate(itmDet.rt),
              taxableValue: r2(Number(itmDet.txval) || 0),
              cessAmount: r2(Number(itmDet.csamt) || 0),
            });
          }
        }
      }
    }

    return {
      sourceType: "govt_template",
      b2b,
      b2cs,
      b2cl,
      cdnr,
      cdnur,
    };
  } catch {
    return {
      sourceType: "unknown",
      b2b: [],
      b2cs: [],
      b2cl: [],
      cdnr: [],
      cdnur: [],
    };
  }
}

// ── Auto-detecting Parser ─────────────────────────────────────────────────────

/**
 * Detects whether the workbook is:
 *   - Amazon's auto-generated GSTR-1 (has "GSTIN" + "B2C Small" sheets)
 *   - Government's GSTR-1 template V2.1 (has "b2b,sez,de" + "b2cs" sheets)
 * and calls the appropriate parser.
 */
export function parseGstr1File(workbook: XLSX.WorkBook): ParsedGstr1Template {
  const sheetNames = workbook.SheetNames.map((s) => s.toLowerCase());

  const isAmazon =
    sheetNames.includes("gstin") &&
    (sheetNames.includes("b2c small") || sheetNames.includes("b2b"));

  const isGovt =
    sheetNames.some((s) => s.startsWith("b2b") && !s.includes("cn")) && sheetNames.includes("b2cs");

  if (isAmazon && !isGovt) return parseAmazonGstr1(workbook);
  if (isGovt) return parseGovtTemplate(workbook);

  // Fallback: try govt template parser (most common uploaded format)
  return { ...parseGovtTemplate(workbook), sourceType: "unknown" };
}

/**
 * Detects whether buffer is JSON or XLSX, then parses accordingly.
 */
/**
 * Byte-based entry point, usable in the browser as well as on the server.
 *
 * The comparison parses its reference file client-side — a government template
 * is around 7 MB and the deployment's request limit is 4.5 MB, so uploading it
 * to a Server Action can never succeed.
 */
export function parseGstr1Bytes(bytes: Uint8Array, fileName?: string): ParsedGstr1Template {
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, Math.min(100, bytes.length)));
  const isJson = fileName?.toLowerCase().endsWith(".json") || head.trim().startsWith("{");

  if (isJson) {
    return parseGstr1Json(new TextDecoder("utf-8").decode(bytes));
  }

  const { workbook } = readWorkbookSafely(bytes, { raw: true });
  return parseGstr1File(workbook);
}

export function parseGstr1Buffer(buffer: Buffer, fileName?: string): ParsedGstr1Template {
  const isJson =
    fileName?.toLowerCase().endsWith(".json") ||
    buffer.toString("utf8", 0, Math.min(100, buffer.length)).trim().startsWith("{");

  if (isJson) {
    return parseGstr1Json(buffer.toString("utf8"));
  }

  const { workbook } = readWorkbookSafely(buffer, { raw: true });
  return parseGstr1File(workbook);
}
