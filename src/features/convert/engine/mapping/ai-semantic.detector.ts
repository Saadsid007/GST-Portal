import { ValueValidator } from "./value-validator";

function sanitize(str: string): string {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * AI & Semantic Schema Detector:
 * Uses semantic analysis of raw headers and sample data values to infer field bindings
 * for unknown or modified marketplace formats.
 */
export class AiSemanticDetector {
  static detectSemanticField(
    canonicalKey: string,
    headers: string[],
    sampleRows: Record<string, unknown>[]
  ): { mappedHeader: string | null; confidence: number; reason: string } {
    for (const header of headers) {
      const normHeader = sanitize(header);
      const sampleValues = sampleRows.slice(0, 10).map((r) => r[header]);

      // 1. Semantic pattern rules based on canonical key
      if (canonicalKey === "buyerGstin") {
        const valCheck = ValueValidator.validateFieldValues("buyerGstin", sampleValues);
        if (valCheck.isValid && valCheck.passRate > 0.4) {
          return {
            mappedHeader: header,
            confidence: Math.round(80 + valCheck.passRate * 18),
            reason: `AI Semantic: Values match GSTIN pattern (${Math.round(valCheck.passRate * 100)}% sample match)`,
          };
        }
      }

      if (canonicalKey === "hsnCode") {
        const valCheck = ValueValidator.validateFieldValues("hsnCode", sampleValues);
        if (
          valCheck.isValid &&
          (normHeader.includes("hsn") || normHeader.includes("sac") || valCheck.passRate > 0.6)
        ) {
          return {
            mappedHeader: header,
            confidence: 88,
            reason: "AI Semantic: Header & numeric pattern match HSN/SAC code",
          };
        }
      }

      if (canonicalKey === "taxableValue") {
        if (
          normHeader.includes("taxable") ||
          normHeader.includes("amount") ||
          normHeader.includes("sale") ||
          normHeader.includes("subtotal") ||
          normHeader.includes("value")
        ) {
          const valCheck = ValueValidator.validateFieldValues("taxableValue", sampleValues);
          if (valCheck.isValid) {
            return {
              mappedHeader: header,
              confidence: 85,
              reason: "AI Semantic: Numeric currency pattern & sales amount relationship",
            };
          }
        }
      }

      if (canonicalKey === "placeOfSupply") {
        if (
          normHeader.includes("pos") ||
          normHeader.includes("state") ||
          normHeader.includes("destination")
        ) {
          return {
            mappedHeader: header,
            confidence: 82,
            reason: "AI Semantic: Header & state code relationship",
          };
        }
      }

      if (canonicalKey === "invoiceNumber") {
        if (
          normHeader.includes("inv") ||
          normHeader.includes("order") ||
          normHeader.includes("number") ||
          normHeader.includes("id")
        ) {
          return {
            mappedHeader: header,
            confidence: 85,
            reason: "AI Semantic: Invoice/Order ID identifier pattern",
          };
        }
      }
    }

    return {
      mappedHeader: null,
      confidence: 0,
      reason: "No semantic pattern match",
    };
  }
}
