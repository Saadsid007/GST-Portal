import type { DocumentType, Evidence, ReconstructedTable, WorkbookUnderstanding } from "./types";
import { looksLikeGstin, parseDateValue, parseNumeric } from "./signals";

/**
 * Layer 2 — workbook understanding.
 *
 * Runs before any column is mapped. What the workbook *is* changes what its
 * columns mean: a negative amount in a sales report is a data error, the same
 * value in a returns report is the point of the document. Deciding the document
 * type first stops the mapper making that mistake.
 *
 * The marketplace hint is recorded because it is useful in the audit trail. It
 * is deliberately not returned to any code path that selects behaviour — no
 * parser is chosen from it, and an unrecognised marketplace costs nothing.
 */

const RETURN_WORDS = ["return", "refund", "rto", "cancelled", "cancellation", "reversal"];
const CREDIT_NOTE_WORDS = ["credit note", "creditnote", "cdnr", "debit note"];
const SETTLEMENT_WORDS = ["settlement", "payout", "remittance", "commission", "fee", "utr"];
const TAX_REPORT_WORDS = ["gstr", "tcs", "tds", "tax report", "b2b", "b2cs"];

/** Recognised only to label the audit trail. Never used to select a parser. */
const MARKETPLACE_FINGERPRINTS: { name: string; words: string[] }[] = [
  { name: "Amazon", words: ["mtr", "asin", "fulfillment channel", "seller sku", "amazon"] },
  { name: "Flipkart", words: ["fsn", "flipkart", "fulfilment type"] },
  { name: "Meesho", words: ["meesho", "sub order num", "supplier listed price"] },
  { name: "Myntra", words: ["myntra", "style id"] },
  { name: "Shopify", words: ["shopify", "lineitem", "financial status"] },
  { name: "WooCommerce", words: ["woocommerce", "order status", "billing state"] },
  { name: "Shiprocket", words: ["shiprocket", "awb", "courier name"] },
  { name: "Unicommerce", words: ["unicommerce", "sale order code"] },
  { name: "EasyEcom", words: ["easyecom", "company invoice"] },
  { name: "GlowRoad", words: ["glowroad", "reseller"] },
  { name: "JioMart", words: ["jiomart", "jio"] },
  { name: "Snapdeal", words: ["snapdeal", "suborder"] },
  { name: "Ajio", words: ["ajio"] },
];

function corpus(table: ReconstructedTable): string {
  const headerText = table.headers.join(" ").toLowerCase();
  const sheetText = table.sheetName.toLowerCase();
  return `${sheetText} ${headerText}`;
}

/** Counts how many scanned rows carry a word from the list, in any column. */
function rowsMentioning(table: ReconstructedTable, words: string[], limit = 300): number {
  let hits = 0;
  for (const row of table.rows.slice(0, limit)) {
    const text = Object.values(row).join(" ").toLowerCase();
    if (words.some((w) => text.includes(w))) hits++;
  }
  return hits;
}

function detectDocumentType(table: ReconstructedTable): {
  type: DocumentType;
  confidence: number;
  evidence: Evidence[];
} {
  const text = corpus(table);
  const evidence: Evidence[] = [];
  const scanned = Math.min(table.rows.length, 300);

  const returnRows = rowsMentioning(table, RETURN_WORDS);
  const creditRows = rowsMentioning(table, CREDIT_NOTE_WORDS);
  const returnShare = scanned === 0 ? 0 : returnRows / scanned;

  // Negative amounts are the structural signature of a return or credit note,
  // independent of any wording.
  let negativeRows = 0;
  for (const row of table.rows.slice(0, 300)) {
    const hasNegative = Object.values(row).some((value) => {
      const num = parseNumeric(value);
      return num !== null && num < 0;
    });
    if (hasNegative) negativeRows++;
  }
  const negativeShare = scanned === 0 ? 0 : negativeRows / scanned;

  if (SETTLEMENT_WORDS.filter((w) => text.includes(w)).length >= 2) {
    evidence.push({
      source: "DOCUMENT_CONTEXT",
      detail: "Headers describe payouts, commissions and settlement references",
      weight: 60,
    });
    return { type: "SETTLEMENT", confidence: 75, evidence };
  }

  if (TAX_REPORT_WORDS.some((w) => text.includes(w)) && /gstr|b2cs|b2b/.test(text)) {
    evidence.push({
      source: "DOCUMENT_CONTEXT",
      detail: "Headers use GSTR section vocabulary, so this is already a tax report",
      weight: 55,
    });
    return { type: "TAX_REPORT", confidence: 70, evidence };
  }

  if (creditRows > 0 && creditRows / scanned > 0.5) {
    evidence.push({
      source: "DOCUMENT_CONTEXT",
      detail: `${creditRows} of ${scanned} scanned rows are marked as credit or debit notes`,
      weight: 60,
    });
    return { type: "CREDIT_NOTES", confidence: 80, evidence };
  }

  if (returnShare > 0.85 || (negativeShare > 0.85 && returnShare > 0.2)) {
    evidence.push({
      source: "DOCUMENT_CONTEXT",
      detail: `${Math.round(returnShare * 100)}% of rows carry return or cancellation wording`,
      weight: 60,
    });
    return { type: "RETURNS", confidence: 85, evidence };
  }

  if (returnShare > 0.02 || negativeShare > 0.02) {
    evidence.push({
      source: "DOCUMENT_CONTEXT",
      detail: `Sales and returns both present — ${Math.round(returnShare * 100)}% return-marked rows, ${Math.round(negativeShare * 100)}% with negative amounts`,
      weight: 50,
    });
    return { type: "MIXED", confidence: 78, evidence };
  }

  if (table.rows.length > 0) {
    evidence.push({
      source: "DOCUMENT_CONTEXT",
      detail: "No return, credit-note or settlement markers, and no negative amounts",
      weight: 40,
    });
    return { type: "SALES", confidence: 70, evidence };
  }

  return { type: "UNKNOWN", confidence: 0, evidence };
}

/**
 * The month the file reports on.
 *
 * Read from whichever column parses as a date most consistently, rather than
 * from the first parseable cell in each row: an order-reference column can
 * yield the occasional accidental date, and a single stray one would otherwise
 * decide the filing period.
 */
function detectPeriod(table: ReconstructedTable): { period: string | null; confidence: number } {
  const scanned = table.rows.slice(0, 500);

  let dateColumn: string | null = null;
  let bestRate = 0;
  for (const header of table.headers) {
    const values = scanned.map((row) => row[header] ?? "").filter((v) => v !== "");
    if (values.length === 0) continue;
    const rate = values.filter((v) => parseDateValue(v) !== null).length / values.length;
    if (rate > bestRate) {
      bestRate = rate;
      dateColumn = header;
    }
  }

  if (!dateColumn || bestRate < 0.5) return { period: null, confidence: 0 };

  const counts = new Map<string, number>();
  let parsed = 0;

  for (const row of scanned) {
    const date = parseDateValue(row[dateColumn] ?? "");
    if (!date) continue;
    const key = `${String(date.getUTCMonth() + 1).padStart(2, "0")}${date.getUTCFullYear()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    parsed++;
  }

  if (parsed === 0) return { period: null, confidence: 0 };

  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }

  // A filing period should dominate. A spread across many months means the file
  // is not a single return's worth of data, and the user must choose.
  const share = bestCount / parsed;
  return { period: best, confidence: Math.round(share * 100) };
}

function detectMarketplace(table: ReconstructedTable): string | null {
  const text = corpus(table);
  for (const fingerprint of MARKETPLACE_FINGERPRINTS) {
    if (fingerprint.words.some((w) => text.includes(w))) return fingerprint.name;
  }
  return null;
}

export function understandWorkbook(table: ReconstructedTable): WorkbookUnderstanding {
  const document = detectDocumentType(table);
  const period = detectPeriod(table);

  const scanned = table.rows.slice(0, 500);
  let gstinRows = 0;
  for (const row of scanned) {
    if (Object.values(row).some((value) => looksLikeGstin(value))) gstinRows++;
  }
  const b2bShare = scanned.length === 0 ? 0 : gstinRows / scanned.length;

  const supplyMix: WorkbookUnderstanding["supplyMix"] =
    scanned.length === 0 ? "UNKNOWN" : b2bShare > 0.9 ? "B2B" : b2bShare < 0.02 ? "B2C" : "MIXED";

  return {
    documentType: document.type,
    documentTypeConfidence: document.confidence,
    documentEvidence: document.evidence,
    marketplaceHint: detectMarketplace(table),
    period: period.period,
    periodConfidence: period.confidence,
    b2bShare: Math.round(b2bShare * 100) / 100,
    supplyMix,
    rowCount: table.rows.length,
    columnCount: table.headers.length,
  };
}
