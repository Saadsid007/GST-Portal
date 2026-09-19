import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";

export interface DetectionResult {
  platformId: string;
  platformName: string;
  fileTypeId: string;
  parserVersion: string;
  confidence: number; // 0 to 100
  matchedKeywords: string[];
}

function sanitize(str: string): string {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * The score above which the session manager hands a file to a platform
 * adapter. Below it, the file is either an own-books register or goes to the
 * AI mapper.
 */
const ADAPTER_THRESHOLD = 50;

/** Sanitised column names that only a marketplace export carries. */
const MARKETPLACE_ONLY = [
  "orderid",
  "orderitemid",
  "suborder",
  "suborderno",
  "subordernum",
  "shipmentid",
  "shipmentitemid",
  "asin",
  "fsn",
  "sellergstin",
  "ecotcsgstin",
  "fulfilmenttype",
  "fulfillmentchannel",
  "warehouseid",
];

/**
 * True when the columns describe invoices the seller raised themselves.
 *
 * Requires an invoice reference and a value, and the absence of any
 * marketplace field. Both halves matter: without the value test a document
 * index would qualify, and without the marketplace test a Meesho export —
 * which also has an invoice number and a taxable value — would be pulled away
 * from the adapter that understands its TCS and operator columns.
 */
function looksLikeInvoiceRegister(normHeaders: string[]): boolean {
  const has = (...needles: string[]) => needles.some((n) => normHeaders.some((h) => h.includes(n)));

  if (normHeaders.some((h) => MARKETPLACE_ONLY.some((m) => h === m))) return false;

  const hasReference = has("invoicenumber", "invoiceno", "billno", "notenumber");
  const hasValue = has("taxablevalue", "taxableamount", "invoicevalue", "gstamount", "taxamount");

  return hasReference && hasValue;
}

/**
 * Auto Platform & Report Type Detector:
 * Analyzes raw headers, sheet names, and file patterns to automatically identify the marketplace,
 * report slot, parser version, and confidence score.
 */
export class PlatformDetector {
  static detect(headers: string[], sheetName?: string, fileName?: string): DetectionResult {
    const normHeaders = headers.map((h) => sanitize(h));
    const normSheet = sanitize(sheetName || "");
    const normFile = sanitize(fileName || "");

    let bestMatch: DetectionResult = {
      platformId: "custom",
      platformName: "Custom Excel",
      fileTypeId: "custom_file",
      parserVersion: "v1",
      confidence: 30,
      matchedKeywords: [],
    };

    // ── Early exit: GST Extracted Invoices (Offline / Direct Invoices) ─────────
    if (
      normFile.includes("gstextractedinvoices") ||
      normFile.includes("offline") ||
      normSheet.includes("invoicelineitems") ||
      normSheet.includes("allextracted")
    ) {
      if (normFile.includes("gstextractedinvoices") && !normSheet.includes("invoicelineitems")) {
        return {
          platformId: "offline",
          platformName: "Offline & Direct Invoices",
          fileTypeId: "offline_summary_ref",
          parserVersion: "v1",
          confidence: 90,
          matchedKeywords: ["File: Offline summary sheet (skipped in favor of line items)"],
        };
      }
      if (
        normSheet.includes("hsn") ||
        normSheet.includes("b2cs") ||
        normSheet.includes("docs") ||
        normSheet.includes("help") ||
        normSheet.includes("master")
      ) {
        return {
          platformId: "offline",
          platformName: "Offline & Direct Invoices",
          fileTypeId: "offline_summary_ref",
          parserVersion: "v1",
          confidence: 90,
          matchedKeywords: ["File: Offline summary sheet (skipped)"],
        };
      }

      return {
        platformId: "offline",
        platformName: "Offline & Direct Invoices",
        fileTypeId: "offline_invoices",
        parserVersion: "v1",
        confidence: 95,
        matchedKeywords: ["File: GST Extracted Invoices (Offline / Direct)"],
      };
    }

    // ── Early exit: Amazon GSTR-1 reference file ─────────────────────────────
    // Amazon's auto-generated GSTR-1 exports follow the pattern:
    //   GSTR1-<MONTH>-<YEAR>-<ID>-<GSTIN>.xlsx
    // These must NEVER be processed as MTR data — they are reference-only and
    // should route to the amazon_gstr1_ref slot (comparison tab), not a data adapter.
    if (normFile.startsWith("gstr1") && normFile.includes("amazon")) {
      return {
        platformId: "amazon",
        platformName: "Amazon Seller MTR",
        fileTypeId: "amazon_gstr1_ref",
        parserVersion: "v1",
        confidence: 95,
        matchedKeywords: ["File: Amazon GSTR-1 (reference only)"],
      };
    }
    // Also catch gov-format GSTR-1 uploads by sheet name presence
    const sheetNamesLower = (sheetName || "").toLowerCase();
    if (
      sheetNamesLower.includes("b2b") &&
      (normFile.startsWith("gstr1") || normFile.includes("gstr1"))
    ) {
      return {
        platformId: "amazon",
        platformName: "Amazon Seller MTR",
        fileTypeId: "amazon_gstr1_ref",
        parserVersion: "v1",
        confidence: 90,
        matchedKeywords: ["File: GSTR-1 reference workbook"],
      };
    }

    let highestScore = 0;

    for (const plat of PLATFORMS_CONFIG) {
      for (const fileSlot of plat.files) {
        let score = 0;
        const matchedKeywords: string[] = [];

        // 1. File name match
        if (normFile.includes(sanitize(plat.id)) || normFile.includes(sanitize(plat.name))) {
          score += 40;
          matchedKeywords.push(`File: ${plat.name}`);
        }

        // 2. Sheet name match
        if (
          normSheet.includes(sanitize(fileSlot.id)) ||
          normSheet.includes(sanitize(fileSlot.name))
        ) {
          score += 20;
          matchedKeywords.push(`Sheet: ${fileSlot.name}`);
        }

        // 3. Header & Sheet keyword matches
        if (fileSlot.headerKeywords) {
          for (const kw of fileSlot.headerKeywords) {
            const sanitizedKw = sanitize(kw);
            const foundHeader = normHeaders.some((h) => h.includes(sanitizedKw));
            const foundSheet = normSheet.includes(sanitizedKw);
            if (foundHeader || foundSheet) {
              score += 15;
              matchedKeywords.push(`Keyword: ${kw}`);
            }
          }
        }

        if (score > highestScore) {
          highestScore = score;
          const confidence = Math.min(Math.max(score, 40), 99);
          bestMatch = {
            platformId: plat.id,
            platformName: plat.name,
            fileTypeId: fileSlot.id,
            parserVersion: plat.id === "amazon" ? "v3" : "v2",
            confidence,
            matchedKeywords,
          };
        }
      }
    }

    // ── Own invoice registers ────────────────────────────────────────────────
    // A seller's own books arrive as an ordinary register: a B2B invoice list,
    // a wholesale bill sheet, an "Invoice Wise GST Report". They carry no
    // marketplace fields, so the scoring above finds nothing and they fall
    // through to the AI mapper — for a file whose columns are already the
    // plainest possible statement of an invoice.
    //
    // Deliberately a last resort rather than an early exit. The shape it looks
    // for ("has an invoice number and a value") is also true of every
    // marketplace export, so running it first would pull Amazon and Meesho
    // files away from the adapters that understand their TCS and operator
    // columns.
    if (highestScore < ADAPTER_THRESHOLD && looksLikeInvoiceRegister(normHeaders)) {
      return {
        platformId: "offline",
        platformName: "Offline & Direct Invoices",
        fileTypeId: "offline_invoices",
        parserVersion: "v1",
        confidence: 85,
        matchedKeywords: ["Structure: invoice register (own books)"],
      };
    }

    return bestMatch;
  }
}
