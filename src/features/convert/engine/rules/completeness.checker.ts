import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import type { MultiUploadFileInput } from "@/features/convert/types/convert.types";

export interface CompletenessWarning {
  platformId: string;
  platformName: string;
  missingFileTypeId: string;
  missingFileName: string;
  message: string;
  severity: "WARNING" | "CRITICAL";
}

export interface CompletenessCheckResult {
  isComplete: boolean;
  warnings: CompletenessWarning[];
}

/**
 * Upload Completeness Checker:
 * Evaluates uploaded report files against required slots per marketplace.
 */
export class CompletenessChecker {
  static checkCompleteness(
    selectedPlatformIds: string[],
    uploadedFiles: MultiUploadFileInput[]
  ): CompletenessCheckResult {
    const warnings: CompletenessWarning[] = [];

    for (const platId of selectedPlatformIds) {
      const platConfig = PLATFORMS_CONFIG.find((p) => p.id === platId);
      if (!platConfig) continue;

      for (const fileSlot of platConfig.files) {
        if (fileSlot.required) {
          const uploaded = uploadedFiles.some(
            (f) => f.platformId === platId && f.fileTypeId === fileSlot.id
          );

          if (!uploaded) {
            warnings.push({
              platformId: platId,
              platformName: platConfig.name,
              missingFileTypeId: fileSlot.id,
              missingFileName: fileSlot.name,
              message: `${platConfig.name}: '${fileSlot.name}' is missing. Net sales calculation may not be accurate.`,
              severity: "WARNING",
            });
          }
        }
      }
    }

    return {
      isComplete: warnings.length === 0,
      warnings,
    };
  }
}
