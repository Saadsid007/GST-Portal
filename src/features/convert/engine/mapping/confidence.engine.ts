import type { FieldConfidence } from "./types";
import { CANONICAL_FIELDS } from "./mapping.templates";
import { ValueValidator } from "./value-validator";
import { AiSemanticDetector } from "./ai-semantic.detector";

function sanitize(str: string): string {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function tokenize(str: string): string[] {
  return String(str || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Confidence Engine:
 * Evaluates mapping layers and sample data value checks to output confidence scores.
 */
export class ConfidenceEngine {
  static evaluateField(
    canonicalKey: string,
    allHeaders: string[],
    predefinedMapping?: string,
    sampleRows: Record<string, unknown>[] = []
  ): FieldConfidence {
    const fieldDef = CANONICAL_FIELDS.find((f) => f.key === canonicalKey);
    const label = fieldDef?.label || canonicalKey;
    // Spreadsheets routinely carry trailing blank columns that xlsx names "__EMPTY". Binding a
    // field to one of them looks like a successful mapping but silently yields no data.
    const headers = allHeaders.filter(
      (h) => !ValueValidator.isEmptyColumn(sampleRows.slice(0, 10).map((r) => r[h]))
    );
    const normHeaders = headers.map((h) => ({
      original: h,
      sanitized: sanitize(h),
      tokens: tokenize(h),
    }));

    // Layer 1: Predefined / Saved Memory Template (95% Confidence)
    // An empty string means the template deliberately suppresses this field (the platform's
    // column exists but is untrustworthy), so it must not fall through to alias detection.
    if (predefinedMapping === "") {
      return {
        targetField: canonicalKey,
        targetLabel: label,
        mappedHeader: null,
        confidence: 0,
        detectionMethod: "MANUAL_USER",
        reason: "Field intentionally left unmapped by the marketplace template.",
        validationStatus: "NOT_TESTED",
      };
    }

    if (predefinedMapping) {
      const found = headers.find((h) => sanitize(h) === sanitize(predefinedMapping));
      if (found) {
        const sampleValues = sampleRows.slice(0, 10).map((r) => r[found]);
        const valCheck = ValueValidator.validateFieldValues(canonicalKey, sampleValues);
        const confidence = valCheck.isValid ? 98 : 70;
        return {
          targetField: canonicalKey,
          targetLabel: label,
          mappedHeader: found,
          confidence,
          detectionMethod: "TEMPLATE_MATCH",
          reason: `Matched by Marketplace Template / DB Saved Profile (${valCheck.reason})`,
          validationStatus: valCheck.isValid ? "VALIDATED" : "INVALID_SAMPLE_VALUES",
        };
      }
    }

    // Layer 2: Exact Header Match (100% Confidence)
    const exactMatch = normHeaders.find(
      (nh) => nh.sanitized === sanitize(canonicalKey) || nh.sanitized === sanitize(label)
    );
    if (exactMatch) {
      const sampleValues = sampleRows.slice(0, 10).map((r) => r[exactMatch.original]);
      const valCheck = ValueValidator.validateFieldValues(canonicalKey, sampleValues);
      return {
        targetField: canonicalKey,
        targetLabel: label,
        mappedHeader: exactMatch.original,
        confidence: valCheck.isValid ? 100 : 75,
        detectionMethod: "EXACT_MATCH",
        reason: `Exact header match for '${exactMatch.original}' (${valCheck.reason})`,
        validationStatus: valCheck.isValid ? "VALIDATED" : "INVALID_SAMPLE_VALUES",
      };
    }

    // Layer 3: Alias Dictionary Match (95% Confidence)
    if (fieldDef?.aliases) {
      for (const alias of fieldDef.aliases) {
        const aliasMatch = normHeaders.find((nh) => nh.sanitized === sanitize(alias));
        if (aliasMatch) {
          const sampleValues = sampleRows.slice(0, 10).map((r) => r[aliasMatch.original]);
          const valCheck = ValueValidator.validateFieldValues(canonicalKey, sampleValues);
          return {
            targetField: canonicalKey,
            targetLabel: label,
            mappedHeader: aliasMatch.original,
            confidence: valCheck.isValid ? 95 : 70,
            detectionMethod: "ALIAS_MATCH",
            reason: `Matched alias '${alias}' to header '${aliasMatch.original}'`,
            validationStatus: valCheck.isValid ? "VALIDATED" : "INVALID_SAMPLE_VALUES",
          };
        }
      }
    }

    // Layer 4: Token-containment Match (85% Confidence) — every alias token must appear as a
    // whole token in the header, so 'sgst' never matches inside 'eco_tcs_gstin'.
    if (fieldDef?.aliases) {
      for (const alias of fieldDef.aliases) {
        const aliasTokens = tokenize(alias);
        const fuzzyMatches = normHeaders.filter((nh) =>
          aliasTokens.every((t) => nh.tokens.includes(t))
        );
        for (const fuzzyMatch of fuzzyMatches) {
          const sampleValues = sampleRows.slice(0, 10).map((r) => r[fuzzyMatch.original]);
          const valCheck = ValueValidator.validateFieldValues(canonicalKey, sampleValues);
          if (!valCheck.isValid) continue;
          return {
            targetField: canonicalKey,
            targetLabel: label,
            mappedHeader: fuzzyMatch.original,
            confidence: 85,
            detectionMethod: "FUZZY_MATCH",
            reason: `Fuzzy matched '${alias}' with '${fuzzyMatch.original}'`,
            validationStatus: "VALIDATED",
          };
        }
      }
    }

    // Layer 5: AI & Semantic Pattern Detection (80% - 90% Confidence)
    const aiResult = AiSemanticDetector.detectSemanticField(canonicalKey, headers, sampleRows);
    if (aiResult.mappedHeader) {
      return {
        targetField: canonicalKey,
        targetLabel: label,
        mappedHeader: aiResult.mappedHeader,
        confidence: aiResult.confidence,
        detectionMethod: "AI_SEMANTIC_MATCH",
        reason: aiResult.reason,
        validationStatus: "VALIDATED",
      };
    }

    // Unmapped Failsafe
    return {
      targetField: canonicalKey,
      targetLabel: label,
      mappedHeader: null,
      confidence: 0,
      detectionMethod: "MANUAL_USER",
      reason: "Could not auto-detect mapping. Requires manual assignment.",
      validationStatus: "NOT_TESTED",
    };
  }
}
