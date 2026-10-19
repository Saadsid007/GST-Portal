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

/** One thing the upload must have: a single required slot, or any one of a group. */
export interface RequirementUnit {
  platformId: string;
  label: string;
  slots: string[];
}

export function requirementUnits(platformId: string): RequirementUnit[] {
  const platConfig = PLATFORMS_CONFIG.find((p) => p.id === platformId);
  if (!platConfig) return [];
  return [
    ...platConfig.files
      .filter((f) => f.required)
      .map((f) => ({ platformId, label: f.name, slots: [f.id] })),
    ...(platConfig.requireOneOf ?? []).map((g) => ({ platformId, label: g.label, slots: g.slots })),
  ];
}

export function isUnitMet(unit: RequirementUnit, uploadedFiles: MultiUploadFileInput[]): boolean {
  return uploadedFiles.some(
    (f) => f.platformId === unit.platformId && unit.slots.includes(f.fileTypeId)
  );
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

      for (const unit of requirementUnits(platId)) {
        if (isUnitMet(unit, uploadedFiles)) continue;
        warnings.push({
          platformId: platId,
          platformName: platConfig.name,
          missingFileTypeId: unit.slots.join("|"),
          missingFileName: unit.label,
          message:
            unit.slots.length > 1
              ? `${platConfig.name}: upload a ${unit.label}.`
              : `${platConfig.name}: '${unit.label}' is missing. Net sales calculation may not be accurate.`,
          severity: "WARNING",
        });
      }
    }

    return {
      isComplete: warnings.length === 0,
      warnings,
    };
  }
}
