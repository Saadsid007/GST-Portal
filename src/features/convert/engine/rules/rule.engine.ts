import { getPlatformRule } from "./rule.config";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

export interface RuleCheckResult {
  passed: boolean;
  missingRequiredFiles: { platformId: string; fileTypeId: string }[];
  warnings: string[];
}

/**
 * Rule Engine — Configuration-driven rule executor for evaluating marketplace requirements and rules.
 */
export class RuleEngine {
  /**
   * Verify that all required files for selected marketplaces are uploaded.
   */
  static verifyFileRequirements(
    selectedPlatformIds: string[],
    uploadedFiles: { platformId: string; fileTypeId: string }[]
  ): RuleCheckResult {
    const missingRequiredFiles: { platformId: string; fileTypeId: string }[] = [];
    const warnings: string[] = [];

    for (const platformId of selectedPlatformIds) {
      const rule = getPlatformRule(platformId);
      for (const reqFileType of rule.requiredFileTypes) {
        const found = uploadedFiles.some(
          (uf) => uf.platformId === platformId && uf.fileTypeId === reqFileType
        );
        if (!found) {
          missingRequiredFiles.push({ platformId, fileTypeId: reqFileType });
          warnings.push(`Missing required file slot '${reqFileType}' for ${platformId}`);
        }
      }
    }

    return {
      passed: missingRequiredFiles.length === 0,
      missingRequiredFiles,
      warnings,
    };
  }

  /**
   * Evaluate rule policies on normalized rows.
   */
  static applyRowRules(rows: NormalizedInvoiceRow[], platformId: string): NormalizedInvoiceRow[] {
    const rule = getPlatformRule(platformId);

    // A blank HSN used to be backfilled here with a per-platform default of
    // 998313 — "information technology consulting services" — which is what
    // every goods seller's unclassified line was declared as in Table 12. It
    // defeated the adapters, which had already stopped inventing codes, and it
    // is why a wrong commodity could reach a filed return while every check
    // passed. There is no correct default: the row now stays blank and the
    // validator asks for it.
    return rows.filter(
      // Marketplace exports include cancelled / free-replacement lines that carry no value at all;
      // they are not supplies and must not reach GSTR-1.
      (row) => rule.allowZeroTaxableValue || row.taxableValue !== 0 || row.totalValue !== 0
    );
  }
}
