import {
  CANONICAL_FIELDS,
  PREDEFINED_TEMPLATES,
  type ColumnMappingDict,
} from "./mapping.templates";
import type { MappedRawRow } from "@/features/convert/engine/transformation/transformation.engine";
import { ConfidenceEngine } from "./confidence.engine";
import { MappingMemoryService } from "./mapping-memory.service";
import type { FieldConfidence, HybridMappingResult } from "./types";

export interface MappingValidationResult {
  isValid: boolean;
  missingRequiredFields: string[];
  mappedFieldsCount: number;
}

/**
 * Universal Mapping Engine — Refactored to Hybrid Intelligent Import System.
 * Combines Layer 1 (Exact), Layer 2 (Alias), Layer 3 (Fuzzy), Layer 4 (Template/DB Memory),
 * and Layer 5 (AI Semantic & Value Validation).
 */
export class MappingEngine {
  /**
   * Run 5-layer Hybrid Mapping Strategy with Value Validation and Confidence Scoring.
   */
  static runHybridMapping(
    headers: string[],
    platformId?: string,
    sampleRows: Record<string, unknown>[] = [],
    savedMemoryMapping?: ColumnMappingDict
  ): HybridMappingResult {
    const mapping: ColumnMappingDict = {};
    const fieldConfidences: FieldConfidence[] = [];
    const missingRequiredFields: string[] = [];

    const predefined =
      savedMemoryMapping || (platformId ? PREDEFINED_TEMPLATES[platformId] : undefined);
    let totalConfidence = 0;

    for (const field of CANONICAL_FIELDS) {
      const predefinedHeader = predefined ? predefined[field.key] : undefined;

      const evalResult = ConfidenceEngine.evaluateField(
        field.key,
        headers,
        predefinedHeader,
        sampleRows
      );

      fieldConfidences.push(evalResult);

      if (evalResult.mappedHeader) {
        mapping[field.key] = evalResult.mappedHeader;
        totalConfidence += evalResult.confidence;
      } else if (field.required) {
        missingRequiredFields.push(field.label);
      }
    }

    const mappedCount = Object.keys(mapping).length;
    const overallConfidence = mappedCount > 0 ? Math.round(totalConfidence / mappedCount) : 0;
    const headerSignature = MappingMemoryService.computeHeaderSignature(headers);

    return {
      mapping,
      fieldConfidences,
      overallConfidence,
      missingRequiredFields,
      isComplete: missingRequiredFields.length === 0,
      headerSignature,
      usedSavedMemory: Boolean(savedMemoryMapping),
    };
  }

  /**
   * Auto-detect header mappings for backward compatibility.
   */
  static autoDetectMapping(
    headers: string[],
    platformId?: string,
    sampleRows: Record<string, unknown>[] = []
  ): ColumnMappingDict {
    const res = this.runHybridMapping(headers, platformId, sampleRows);
    return res.mapping;
  }

  /**
   * Validate that all required canonical fields are mapped.
   */
  static validateMapping(mapping: ColumnMappingDict): MappingValidationResult {
    const missingRequiredFields: string[] = [];

    for (const field of CANONICAL_FIELDS) {
      if (field.required && !mapping[field.key]) {
        missingRequiredFields.push(field.label);
      }
    }

    return {
      isValid: missingRequiredFields.length === 0,
      missingRequiredFields,
      mappedFieldsCount: Object.keys(mapping).length,
    };
  }

  /**
   * Apply column mapping dictionary to raw Excel JSON rows.
   */
  static mapRawRows(
    rawRows: Record<string, unknown>[],
    mapping: ColumnMappingDict
  ): MappedRawRow[] {
    return rawRows.map((row) => {
      const mapped: MappedRawRow = {};
      for (const [canonicalKey, rawHeader] of Object.entries(mapping)) {
        if (rawHeader && row[rawHeader] !== undefined) {
          (mapped as Record<string, unknown>)[canonicalKey] = row[rawHeader];
        }
      }
      return mapped;
    });
  }

  static exportMappingJson(mapping: ColumnMappingDict, profileName: string): string {
    return JSON.stringify({ name: profileName, version: "2.0", mappings: mapping }, null, 2);
  }

  static importMappingJson(jsonStr: string): { name: string; mappings: ColumnMappingDict } {
    const parsed = JSON.parse(jsonStr) as { name?: string; mappings?: ColumnMappingDict };
    return {
      name: parsed.name || "Custom Mapping Profile",
      mappings: parsed.mappings || {},
    };
  }
}
