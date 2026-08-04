import type { ColumnMappingDict } from "./mapping.templates";

export type FieldDetectionMethod =
  | "EXACT_MATCH"
  | "ALIAS_MATCH"
  | "FUZZY_MATCH"
  | "TEMPLATE_MATCH"
  | "AI_SEMANTIC_MATCH"
  | "MANUAL_USER";

export interface FieldConfidence {
  targetField: string;
  targetLabel: string;
  mappedHeader: string | null;
  confidence: number; // 0 to 100
  detectionMethod: FieldDetectionMethod;
  reason: string;
  validationStatus: "VALIDATED" | "INVALID_SAMPLE_VALUES" | "NOT_TESTED";
}

export interface HybridMappingResult {
  mapping: ColumnMappingDict;
  fieldConfidences: FieldConfidence[];
  overallConfidence: number;
  missingRequiredFields: string[];
  isComplete: boolean;
  headerSignature: string;
  usedSavedMemory: boolean;
}

export interface PipelineDebugTraceItem {
  originalHeader: string;
  mappedCanonicalKey: string | null;
  layerMethod: FieldDetectionMethod | "UNMAPPED";
  confidence: number;
  sampleRawValue: string;
  transformedValue: unknown;
  validationResult: "PASS" | "FAIL" | "WARNING";
  gstr1TargetSection: string;
}

export interface PipelineDebugReport {
  fileName: string;
  platformId: string;
  parserVersion: string;
  headerSignature: string;
  traces: PipelineDebugTraceItem[];
  timestamp: string;
}
