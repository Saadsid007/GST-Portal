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

    return (
      rows
        // Marketplace exports include cancelled / free-replacement lines that carry no value at all;
        // they are not supplies and must not reach GSTR-1.
        .filter(
          (row) => rule.allowZeroTaxableValue || row.taxableValue !== 0 || row.totalValue !== 0
        )
        .map((row) => {
          let updatedHsn = row.hsnCode;
          if (!updatedHsn && rule.defaultHsnCode) {
            updatedHsn = rule.defaultHsnCode;
          }

          return {
            ...row,
            hsnCode: updatedHsn,
          };
        })
    );
  }
}
