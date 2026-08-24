import { readWorkbookSafely } from "@/features/convert/utils/workbook.utils";
import {
  CANONICAL_FIELDS,
  type ColumnMappingDict,
} from "@/features/convert/engine/universal/canonical-fields";
import { assignFields } from "./assignment";
import { discoverFields } from "./field-discovery";
import { buildQuestions } from "./questions";
import { reconstructWorkbook } from "./table-reconstructor";
import { understandWorkbook } from "./understanding";
import type {
  ColumnProfile,
  FieldResolution,
  ImportIntelligenceReport,
  QuestionAnswer,
  ReconstructedTable,
  UniversalImportResult,
} from "./types";

/**
 * The universal import engine.
 *
 * Understand → reason → infer → validate → explain, then hand a canonical
 * mapping downstream. Every workbook is solved on its own evidence: no
 * marketplace parser, no saved profile, no memory of previous uploads. The
 * understanding built here is discarded when the import completes.
 *
 * Reasoning runs in passes because conclusions feed each other — knowing the
 * document is a returns file changes how a negative column is read, and
 * knowing which column is the taxable value changes which of two numeric
 * columns is the tax. Passes stop as soon as the mapping stops changing, which
 * on a clean file is after the second.
 */

/** Enough for the mapping to settle; a third pass has never changed one. */
const MAX_PASSES = 4;

export interface UniversalImportOptions {
  fileName: string;
  /** Answers to questions the engine raised on a previous attempt. */
  answers?: QuestionAnswer[];
  /**
   * A mapping the user set by hand. Highest authority in the system — a person
   * looking at their own file outranks any inference drawn from it.
   */
  overrides?: ColumnMappingDict;
}

/** Reads any supported workbook into logical tables. */
export function readWorkbook(buffer: Buffer): ReconstructedTable[] {
  // `cellDates: false` keeps dates as their raw serial or string so the date
  // detectors see what the file actually contains rather than xlsx's guess.
  const { workbook } = readWorkbookSafely(buffer, {
    raw: false,
    cellDates: false,
    codepage: 65001,
  });
  return reconstructWorkbook(workbook);
}

function scoreDiscovery(resolutions: FieldResolution[]): number {
  const required = resolutions.filter((r) => r.required);
  const optional = resolutions.filter((r) => !r.required);

  const requiredScore =
    required.length === 0
      ? 100
      : required.reduce((sum, r) => sum + (r.column ? Math.min(100, r.confidence) : 0), 0) /
        required.length;

  const optionalBound = optional.filter((r) => r.column).length;
  // Optional fields lift the score but cannot rescue a file missing a required one.
  const breadth = optional.length === 0 ? 0 : (optionalBound / optional.length) * 100;

  return Math.round(requiredScore * 0.8 + breadth * 0.2);
}

function mappingFingerprint(mapping: ColumnMappingDict): string {
  return Object.entries(mapping)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([field, column]) => `${field}=${column}`)
    .join("|");
}

/**
 * Applies the user's answers and manual overrides on top of the engine's
 * mapping, and frees any column they displaced so it can be reused.
 */
function applyHumanInput(
  mapping: ColumnMappingDict,
  resolutions: FieldResolution[],
  options: UniversalImportOptions
): void {
  const forced = new Map<string, string>();

  for (const answer of options.answers ?? []) {
    if (!answer.id.startsWith("field:")) continue;
    forced.set(answer.id.slice("field:".length), answer.value);
  }
  for (const [field, column] of Object.entries(options.overrides ?? {})) {
    if (column) forced.set(field, column);
  }

  for (const [field, column] of forced) {
    // Whatever else held this column loses it: one column means one thing.
    for (const [otherField, otherColumn] of Object.entries(mapping)) {
      if (otherField !== field && otherColumn === column) delete mapping[otherField];
    }
    mapping[field] = column;

    const resolution = resolutions.find((r) => r.field === field);
    if (resolution) {
      resolution.column = column;
      resolution.confidence = 100;
      resolution.evidence = [
        {
          source: "USER_ANSWER",
          detail: `Chosen by the user, which outranks every inference drawn from the file`,
          weight: 100,
        },
      ];
    }
  }
}

/**
 * Solves one table: multi-pass discovery and assignment, then the explainable
 * report. Row-level recovery and duplicate classification happen after the
 * canonical transformation, in `recovery.ts` and `duplicates.ts`.
 */
export function solveTable(
  table: ReconstructedTable,
  options: UniversalImportOptions
): UniversalImportResult {
  const understanding = understandWorkbook(table);

  let profiles: ColumnProfile[] = [];
  let mapping: ColumnMappingDict = {};
  let resolutions: FieldResolution[] = [];
  let unmappedColumns: string[] = [];
  let previous = "";
  let passes = 0;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    passes = pass;
    profiles = discoverFields(table);
    const assignment = assignFields(profiles);

    mapping = assignment.mapping;
    resolutions = assignment.resolutions;
    unmappedColumns = assignment.unmappedColumns;

    applyHumanInput(mapping, resolutions, options);

    const fingerprint = mappingFingerprint(mapping);
    if (fingerprint === previous) break;
    previous = fingerprint;
  }

  const questions = buildQuestions(resolutions, profiles);

  // Validation score: how much of what the mapping claims survives contact with
  // the values. A bound field whose evidence is entirely header-derived is
  // weaker than one the values themselves confirm.
  const bound = resolutions.filter((r) => r.column);
  const corroborated = bound.filter((r) =>
    r.evidence.some(
      (e) => e.source !== "HEADER_EXACT" && e.source !== "HEADER_ALIAS" && e.weight > 0
    )
  );
  const validation =
    bound.length === 0 ? 0 : Math.round((corroborated.length / bound.length) * 100);

  const discovery = scoreDiscovery(resolutions);
  const reasoning = Math.round(
    understanding.documentTypeConfidence * 0.5 + Math.min(100, understanding.periodConfidence) * 0.5
  );

  const missingRequired = resolutions.filter((r) => r.required && !r.column).length;

  const report: ImportIntelligenceReport = {
    fileName: options.fileName,
    sheetName: table.sheetName,
    understanding,
    resolutions,
    unmappedColumns,
    recoveries: [],
    duplicates: [],
    questions,
    discarded: table.discarded,
    passes,
    scores: {
      fieldDiscovery: discovery,
      validation,
      reasoning,
      // A missing required field caps the overall score no matter how well the
      // rest of the file was understood — the import cannot be trusted whole.
      overall:
        missingRequired > 0
          ? Math.min(45, Math.round(discovery * 0.5 + validation * 0.3 + reasoning * 0.2))
          : Math.round(discovery * 0.5 + validation * 0.3 + reasoning * 0.2),
    },
  };

  return { mapping, table, report };
}

/** Reads a file and solves its most likely data table. */
export function solveWorkbook(
  buffer: Buffer,
  options: UniversalImportOptions
): UniversalImportResult | null {
  const tables = readWorkbook(buffer);
  const best = tables[0];
  if (!best) return null;
  return solveTable(best, options);
}

/**
 * Projects the reconstructed rows onto canonical field keys.
 *
 * This is the boundary the spec draws: past this point nothing knows the file
 * was ever a spreadsheet, what its columns were called, or which sheet it came
 * from.
 */
export function toCanonicalRows(
  table: ReconstructedTable,
  mapping: ColumnMappingDict
): Record<string, unknown>[] {
  const entries = Object.entries(mapping).filter((entry): entry is [string, string] =>
    Boolean(entry[1])
  );

  return table.rows.map((row) => {
    const canonical: Record<string, unknown> = {};
    for (const [field, column] of entries) {
      const value = row[column];
      if (value !== undefined && value !== "") canonical[field] = value;
    }
    return canonical;
  });
}

/** Required canonical fields the mapping failed to bind, by label. */
export function missingRequiredFields(mapping: ColumnMappingDict): string[] {
  return CANONICAL_FIELDS.filter((field) => field.required && !mapping[field.key]).map(
    (field) => field.label
  );
}
