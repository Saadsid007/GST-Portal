import { STATE_CODES } from "@/features/convert/domain/state-codes";

/**
 * Value-level detectors.
 *
 * These answer "what does this column contain?" without ever looking at its
 * header. Headers lie — they are translated, abbreviated, duplicated, or simply
 * wrong — so every header signal in the discovery engine is corroborated here
 * before it is allowed to decide anything.
 */

/** Structure of a GSTIN: state code, PAN, entity number, Z, checksum. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

/** GST slabs notified under the Act, plus the cess-only 0.1/0.25 rates. */
export const GST_SLABS = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28] as const;

const STATE_NAMES = new Map<string, string>(
  Object.entries(STATE_CODES).map(([code, name]) => [normaliseStateName(name), code])
);

/** Common short forms that appear in delivery-address columns. */
const STATE_ALIASES: Record<string, string> = {
  maharastra: "27",
  mh: "27",
  ka: "29",
  karnatak: "29",
  tn: "33",
  tamilnadu: "33",
  up: "09",
  uttarpradesh: "09",
  dl: "07",
  newdelhi: "07",
  wb: "19",
  westbengal: "19",
  gj: "24",
  ap: "37",
  ts: "36",
  telengana: "36",
  hr: "06",
  rj: "08",
  kl: "32",
  pb: "03",
  or: "21",
  orissa: "21",
  mp: "23",
  br: "10",
  as: "18",
  jk: "01",
  ch: "04",
  ga: "30",
  jh: "20",
  cg: "22",
  uk: "05",
  hp: "02",
  pondicherry: "34",
  puducherry: "34",
};

function normaliseStateName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z]/g, "");
}

export function looksLikeGstin(value: string): boolean {
  return GSTIN_PATTERN.test(value.trim().replace(/\s/g, ""));
}

/**
 * Resolves a state code from a code, a name or a common abbreviation.
 *
 * Bare 1–2 digit numbers are accepted only within the notified 01–38 range;
 * outside it the column is far more likely to be a quantity than a state.
 */
export function resolveStateCode(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{1,2}$/.test(raw)) {
    const code = raw.padStart(2, "0");
    return STATE_CODES[code] ? code : null;
  }

  const key = normaliseStateName(raw);
  if (!key) return null;

  const exact = STATE_NAMES.get(key);
  if (exact) return exact;

  const alias = STATE_ALIASES[key];
  if (alias) return alias;

  // "27-Maharashtra" and "Maharashtra (27)" are both common in delivery reports.
  const embedded = /(\d{2})/.exec(raw);
  if (embedded?.[1] && STATE_CODES[embedded[1]]) {
    const withoutCode = normaliseStateName(raw.replace(embedded[1], ""));
    if (STATE_NAMES.get(withoutCode) === embedded[1]) return embedded[1];
  }
  return null;
}

export function looksLikeState(value: string): boolean {
  return resolveStateCode(value) !== null;
}

/**
 * HSN codes are 4, 6 or 8 digits. Separators are deliberately not stripped:
 * "5/12/26" would otherwise clean up to a plausible 5-digit code and let a date
 * column win the HSN slot.
 */
export function looksLikeHsn(value: string): boolean {
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return false;
  return raw.length === 4 || raw.length === 6 || raw.length === 8;
}

/** Parses money and quantities, tolerating ₹, thousands separators and (123) negatives. */
export function parseNumeric(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;

  const negated = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[₹$,\s()]/g, "");
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;

  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return negated ? -num : num;
}

export function looksNumeric(value: string): boolean {
  return parseNumeric(value) !== null;
}

/** True when the value sits on a notified GST slab, read as a percentage. */
export function looksLikeGstRate(value: string): boolean {
  const num = parseNumeric(value.replace(/%/g, ""));
  if (num === null) return false;
  // A fraction like 0.18 is a rate expressed as a ratio.
  const asPercent = num > 0 && num < 1 ? num * 100 : num;
  return GST_SLABS.some((slab) => Math.abs(slab - asPercent) <= 0.01);
}

/** Normalises a rate cell to a percentage, accepting "18", "18%" and "0.18". */
export function toRatePercent(value: string): number | null {
  const num = parseNumeric(value.replace(/%/g, ""));
  if (num === null) return null;
  const abs = Math.abs(num);
  return abs > 0 && abs < 1 ? abs * 100 : abs;
}

/** Snaps a computed percentage to a notified slab, or null when it lands nowhere. */
export function snapToSlab(percent: number, tolerance = 0.15): number | null {
  const slab = GST_SLABS.find((s) => Math.abs(s - percent) <= tolerance);
  return slab === undefined ? null : slab;
}

const DATE_PATTERNS: RegExp[] = [
  /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
  /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/,
  /^\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{2,4}$/,
  /^[A-Za-z]{3,9}\s\d{1,2},?\s\d{4}$/,
];

/**
 * Recognises the date formats marketplaces actually emit, including Excel
 * serials. The serial window is bounded to 2000–2100 so that order ids and
 * pincodes, which are also 5–6 digit numbers, are not read as dates.
 */
export function looksLikeDate(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  if (DATE_PATTERNS.some((p) => p.test(raw))) return true;
  if (/^\d{5}$/.test(raw)) {
    const serial = Number(raw);
    return serial >= 36526 && serial <= 73050;
  }
  return false;
}

/** Extracts a JS date from the same set of formats, for period detection. */
export function parseDateValue(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{5}$/.test(raw)) {
    const serial = Number(raw);
    if (serial < 36526 || serial > 73050) return null;
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  }

  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(raw);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const year = Number(dmy[3]);
    // Indian exports are day-first, so that is the default. The only unambiguous
    // signal to the contrary is a second part above 12, which can only be a day.
    const monthFirst = second > 12 && first <= 12;
    const day = monthFirst ? second : first;
    const month = monthFirst ? first : second;
    if (month > 12 || day > 31) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  // Only hand a string to the Date constructor once a pattern has vouched for
  // it. Left to itself it accepts almost anything — `new Date("INV-1")` yields
  // 31 December 2000 — which would let an invoice-number column be read as
  // dates and set the filing period from nonsense.
  if (!DATE_PATTERNS.some((p) => p.test(raw))) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  return year >= 2000 && year <= 2100 ? parsed : null;
}

/**
 * Invoice and order references: mixed alphanumerics, often with separators.
 * A pure decimal is excluded — that is an amount, not a document number.
 */
export function looksLikeReference(value: string): boolean {
  const raw = value.trim();
  if (raw.length < 3 || raw.length > 48) return false;
  if (/^-?\d+\.\d+$/.test(raw)) return false;
  if (looksLikeDate(raw)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9\-_/#.]*$/.test(raw);
}

/** Free text: contains letters and a space or several words, and is not a GSTIN. */
export function looksLikeName(value: string): boolean {
  const raw = value.trim();
  if (raw.length < 2) return false;
  if (looksLikeGstin(raw)) return false;
  if (looksNumeric(raw)) return false;
  return /[A-Za-z]{2,}/.test(raw);
}

/** Share of samples satisfying a predicate, 0 when there is nothing to judge. */
export function rateOf(samples: string[], predicate: (value: string) => boolean): number {
  if (samples.length === 0) return 0;
  let hits = 0;
  for (const sample of samples) if (predicate(sample)) hits++;
  return hits / samples.length;
}
