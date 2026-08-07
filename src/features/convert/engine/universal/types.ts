import type { ColumnMappingDict } from "@/features/convert/engine/mapping/mapping.templates";

/**
 * Contracts for the universal import engine.
 *
 * The engine solves every workbook from first principles: it never consults a
 * marketplace parser, a saved mapping profile, or a previous upload. Everything
 * it concludes is carried as evidence so the decision can be explained, audited
 * and — where the evidence turns out to be contradictory — withdrawn.
 */

/** A single observation that supports or undermines a conclusion. */
export interface Evidence {
  /** Where the observation came from. */
  source:
    | "HEADER_EXACT"
    | "HEADER_ALIAS"
    | "HEADER_TOKEN"
    | "HEADER_FUZZY"
    | "VALUE_PATTERN"
    | "VALUE_DISTRIBUTION"
    | "UNIQUENESS"
    | "ARITHMETIC"
    | "GST_RULE"
    | "NEIGHBOURING_COLUMN"
    | "CROSS_ROW"
    | "DOCUMENT_CONTEXT"
    | "USER_ANSWER";
  /** Human-readable statement of what was observed. */
  detail: string;
  /** Contribution to the score, positive or negative, roughly in points. */
  weight: number;
}

/** One candidate meaning for a column, kept alongside its rivals. */
export interface FieldHypothesis {
  /** Canonical field key this column might be. */
  field: string;
  /** 0–100. Not a probability; a comparable score. */
  confidence: number;
  evidence: Evidence[];
}

/** Everything the engine measured about one physical column. */
export interface ColumnProfile {
  header: string;
  /** Position in the reconstructed table, used for neighbour reasoning. */
  index: number;
  /** Non-empty sample values, capped. */
  samples: string[];
  /** Share of scanned rows that carried a value. */
  fillRate: number;
  /** Distinct non-empty values over non-empty values. */
  uniqueness: number;
  /** Share of non-empty values parseable as a number. */
  numericRate: number;
  /** Ranked candidate meanings, best first. */
  hypotheses: FieldHypothesis[];
}

/** The logical table recovered from one worksheet. */
export interface ReconstructedTable {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  /** 0-based index of the row the headers were taken from. */
  headerRowIndex: number;
  /** How many header rows were merged into one. */
  headerRowSpan: number;
  /** Rows dropped before the data region, with the reason. */
  discarded: DiscardedRegion[];
  /** 0–100 confidence that this is a real data table. */
  score: number;
}

export interface DiscardedRegion {
  kind: "PREAMBLE" | "BLANK" | "REPEATED_HEADER" | "TOTALS" | "FOOTER" | "SPARSE";
  rowIndex: number;
  reason: string;
}

export type DocumentType =
  "SALES" | "RETURNS" | "CREDIT_NOTES" | "MIXED" | "SETTLEMENT" | "TAX_REPORT" | "UNKNOWN";

/** What the engine concluded about the workbook before mapping anything. */
export interface WorkbookUnderstanding {
  documentType: DocumentType;
  documentTypeConfidence: number;
  /** Evidence behind the document-type call. */
  documentEvidence: Evidence[];
  /** Detected marketplace, purely informational — never used to select a parser. */
  marketplaceHint: string | null;
  /** MMYYYY when a single dominant period was observed. */
  period: string | null;
  periodConfidence: number;
  /** Share of rows carrying a valid buyer GSTIN. */
  b2bShare: number;
  supplyMix: "B2B" | "B2C" | "MIXED" | "UNKNOWN";
  rowCount: number;
  columnCount: number;
}

export type RecoveryField =
  "gstRate" | "taxSplit" | "taxableValue" | "totalValue" | "placeOfSupply" | "transactionType";

/** A value the engine derived rather than read. */
export interface RecoveryRecord {
  rowIndex: number;
  field: RecoveryField;
  value: string;
  confidence: number;
  /** Ordered steps that produced the value. */
  path: string[];
  evidence: Evidence[];
}

export type DuplicateClass =
  "EXACT_DUPLICATE" | "PARTIAL_DUPLICATE" | "LINE_ITEMS" | "SALE_AND_RETURN" | "DISTINCT";

export interface DuplicateVerdict {
  businessKey: string;
  rowIndexes: number[];
  classification: DuplicateClass;
  explanation: string;
}

/** A business question, asked only when reasoning genuinely could not resolve. */
export interface ClarifyingQuestion {
  id: string;
  /** Phrased as a business question, never as "map column X". */
  question: string;
  field: string;
  options: { value: string; label: string; hint: string }[];
}

/** The user's answer to a clarifying question, fed back into the next pass. */
export interface QuestionAnswer {
  id: string;
  value: string;
}

export interface FieldResolution {
  field: string;
  label: string;
  /** Null when no column could be bound and the value must be recovered or asked about. */
  column: string | null;
  confidence: number;
  evidence: Evidence[];
  /** Runner-up columns, retained so the user can switch without a re-scan. */
  alternatives: { column: string; confidence: number }[];
  required: boolean;
}

/** The full, explainable account of one file's import. */
export interface ImportIntelligenceReport {
  fileName: string;
  sheetName: string;
  understanding: WorkbookUnderstanding;
  resolutions: FieldResolution[];
  /** Columns the engine could not attach any meaning to. */
  unmappedColumns: string[];
  recoveries: RecoveryRecord[];
  duplicates: DuplicateVerdict[];
  questions: ClarifyingQuestion[];
  discarded: DiscardedRegion[];
  /** How many reasoning passes ran before confidence stabilised. */
  passes: number;
  /** 0–100 scores shown in the import summary. */
  scores: {
    fieldDiscovery: number;
    validation: number;
    reasoning: number;
    overall: number;
  };
}

export interface UniversalImportResult {
  mapping: ColumnMappingDict;
  table: ReconstructedTable;
  report: ImportIntelligenceReport;
}
