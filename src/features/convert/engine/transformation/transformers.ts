/**
 * Pure Reusable Value Transformers
 * Normalizes raw marketplace values before validation and business rules processing.
 */

import { normalizeStateCode } from "@/features/convert/domain/state-codes";

/**
 * Date Transformer
 * Normalizes DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD, Excel serials e.g. 45123 -> YYYY-MM-DD
 */
/**
 * Formats using local calendar parts. toISOString() would shift the date backwards for
 * any timezone east of UTC — an IST midnight becomes the previous day.
 */
function toIsoDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function transformDate(val: unknown): string {
  if (val === undefined || val === null || val === "") {
    return "";
  }

  // A true Excel date cell (read with cellDates) already carries the exact calendar day.
  if (val instanceof Date && !isNaN(val.getTime())) {
    return toIsoDay(val);
  }

  let str = String(val).trim();

  // Strip time part if present: "19/06/2026 13:51:00" -> "19/06/2026", "2026-06-19T13:51:00Z" -> "2026-06-19"
  str = str.replace(/T.*$/, "").replace(/\s+\d{1,2}:\d{2}(:\d{2})?.*$/, "");

  // Excel serial number e.g. 45123 or 46174.1013888889
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const excelEpoch = new Date(1899, 11, 30);
    const days = Number(str);
    const date = new Date(excelEpoch.getTime() + days * 86400000);
    return toIsoDay(date);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str);
  if (ddmmyyyy && ddmmyyyy[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const yyyymmdd = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(str);
  if (yyyymmdd && yyyymmdd[1] && yyyymmdd[2] && yyyymmdd[3]) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, "0");
    const day = yyyymmdd[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // DD-MMM-YYYY e.g. 20-Jun-2026 or 20-JUNE-2026
  const ddmmmyyyy = /^(\d{1,2})[/-]([A-Za-z]{3,9})[/-](\d{4})$/.exec(str);
  if (ddmmmyyyy && ddmmmyyyy[1] && ddmmmyyyy[2] && ddmmmyyyy[3]) {
    const day = ddmmmyyyy[1].padStart(2, "0");
    const monthStr = ddmmmyyyy[2].toLowerCase();
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const monthIdx = months.findIndex((m) => monthStr.startsWith(m));
    if (monthIdx >= 0) {
      const month = String(monthIdx + 1).padStart(2, "0");
      return `${ddmmmyyyy[3]}-${month}-${day}`;
    }
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return toIsoDay(d);
    }
  } catch {
    // fallback
  }

  return "";
}

/**
 * Number & Currency Transformer
 * Strips currency symbols, commas, spaces, converts to rounded float.
 */
export function transformNumber(val: unknown, decimals = 2): number {
  if (val === undefined || val === null || val === "") return 0;
  const str = String(val).replace(/[^0-9.-]/g, "");
  const num = Number(str);
  if (isNaN(num)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Tax Rate Transformer
 * Normalizes "18%", "18.00", "18" -> 18
 */
export function transformTaxRate(val: unknown): number {
  if (val === undefined || val === null || val === "") return 0;
  const num = transformNumber(val, 4);
  // Fractional form e.g. 0.025 -> 2.5. Must not round to an integer: Amazon uses 2.5% slabs.
  if (num > 0 && num < 1) {
    return Math.round(num * 100 * 100) / 100;
  }
  return num;
}

/**
 * GSTIN Transformer
 * Uppercase, trim whitespace, remove spaces/hyphens
 */
export function transformGstin(val: unknown): string {
  if (!val) return "";
  return String(val)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Invoice Number Transformer
 * Trim, remove invalid symbols while keeping hyphens and slashes
 */
export function transformInvoiceNumber(val: unknown): string {
  if (!val) return "";
  const str = String(val).trim().replace(/\s+/g, "");
  return str;
}

/**
 * State Code Transformer
 * Resolves state names or GSTIN prefix -> 2-digit state code e.g. "27"
 */
export function transformStateCode(val: unknown, buyerGstin?: string): string {
  const fromGstin = normalizeStateCode(buyerGstin);
  if (fromGstin) return fromGstin;
  return normalizeStateCode(val);
}

/** Stand-in used when a row carries no buyer name, so downstream code can spot a real value. */
export const FALLBACK_BUYER_NAME = "Customer";

/** Stand-in used when a row carries no HSN at all, so downstream code can spot a real value. */
export const FALLBACK_HSN = "998313";

/**
 * HSN Code Transformer
 * Strips non-digit characters, keeps leading zeros
 */
export function transformHsn(val: unknown, defaultHsn = FALLBACK_HSN): string {
  if (!val) return defaultHsn;
  const digits = String(val).replace(/\D/g, "");
  return digits || defaultHsn;
}

/** GSTN unit codes, keyed by the spellings marketplaces actually export. */
const UQC_ALIASES: Record<string, string> = {
  pcs: "PCS",
  pc: "PCS",
  piece: "PCS",
  pieces: "PCS",
  nos: "NOS",
  no: "NOS",
  unit: "PCS",
  units: "PCS",
  ea: "PCS",
  each: "PCS",
  kg: "KGS",
  kgs: "KGS",
  kilogram: "KGS",
  kilograms: "KGS",
  gm: "GMS",
  gms: "GMS",
  gram: "GMS",
  grams: "GMS",
  ltr: "LTR",
  litre: "LTR",
  litres: "LTR",
  liter: "LTR",
  l: "LTR",
  ml: "MLT",
  mlt: "MLT",
  mtr: "MTR",
  meter: "MTR",
  metre: "MTR",
  metres: "MTR",
  cm: "CMS",
  cms: "CMS",
  box: "BOX",
  boxes: "BOX",
  pkt: "PAC",
  packet: "PAC",
  pack: "PAC",
  pac: "PAC",
  set: "SET",
  sets: "SET",
  pair: "PRS",
  pairs: "PRS",
  prs: "PRS",
  dozen: "DOZ",
  doz: "DOZ",
  bag: "BAG",
  bags: "BAG",
  bottle: "BTL",
  btl: "BTL",
  roll: "ROL",
  rol: "ROL",
  sqm: "SQM",
  sqf: "SQF",
};

/**
 * Maps a source unit to a GSTN unit quantity code. "OTH" is the portal's own catch-all,
 * so an unrecognised unit degrades to a valid filing rather than blocking one.
 */
export function transformUqc(val: unknown): string {
  if (!val) return "OTH";
  const raw = String(val).trim();
  if (!raw) return "OTH";

  const normalized = raw.toLowerCase().replace(/[\s.-]/g, "");
  if (UQC_ALIASES[normalized]) return UQC_ALIASES[normalized];

  // Files that already carry a GSTN code ("PCS", "KGS") pass straight through.
  const upper = raw.toUpperCase().replace(/[^A-Z]/g, "");
  return upper.length === 3 ? upper : "OTH";
}
