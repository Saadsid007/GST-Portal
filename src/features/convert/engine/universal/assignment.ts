import {
  CANONICAL_FIELDS,
  type ColumnMappingDict,
} from "@/features/convert/engine/universal/canonical-fields";
import type { ColumnProfile, FieldResolution } from "./types";

/**
 * Layer 4 — turning competing hypotheses into one coherent mapping.
 *
 * Scoring each field independently and taking its best column is the obvious
 * approach and it is wrong: two fields routinely name the same column as their
 * favourite, and whichever is evaluated first wins by accident of iteration
 * order. Here every (column, field) pair competes globally and the strongest
 * claim is settled first, so a 90-point claim on a column always beats a
 * 60-point one regardless of field order.
 *
 * The binding is one-to-one. A column means one thing.
 */

/** Below this, a claim is too weak to act on without asking the user. */
const ACCEPT_THRESHOLD = 25;

/**
 * How much better the winner must be before its rival is dismissed. Closer
 * than this and the runner-up is preserved as a genuine alternative, which is
 * what turns into a clarifying question when the field matters.
 */
export const AMBIGUITY_MARGIN = 12;

interface Claim {
  field: string;
  column: string;
  confidence: number;
  profile: ColumnProfile;
}

export interface AssignmentResult {
  mapping: ColumnMappingDict;
  resolutions: FieldResolution[];
  unmappedColumns: string[];
}

/**
 * Fields that must not both bind, because a file carries one or the other.
 * Binding both makes the row double-count tax.
 */
const MUTUALLY_EXCLUSIVE: [string, string][] = [
  ["igstRate", "cgstRate"],
  ["igstRate", "sgstRate"],
];

export function assignFields(profiles: ColumnProfile[]): AssignmentResult {
  const claims: Claim[] = [];
  for (const profile of profiles) {
    for (const hypothesis of profile.hypotheses) {
      claims.push({
        field: hypothesis.field,
        column: profile.header,
        confidence: hypothesis.confidence,
        profile,
      });
    }
  }

  claims.sort((a, b) => b.confidence - a.confidence);

  const fieldToColumn = new Map<string, Claim>();
  const takenColumns = new Set<string>();

  for (const claim of claims) {
    if (claim.confidence < ACCEPT_THRESHOLD) continue;
    if (fieldToColumn.has(claim.field)) continue;
    if (takenColumns.has(claim.column)) continue;

    const conflict = MUTUALLY_EXCLUSIVE.some(
      ([a, b]) =>
        (claim.field === a && fieldToColumn.has(b)) || (claim.field === b && fieldToColumn.has(a))
    );
    // Both forms of a rate can legitimately appear in one file when the export
    // carries all three components; only block when the rival is stronger.
    if (conflict) {
      const rivalField = MUTUALLY_EXCLUSIVE.find(
        ([a, b]) => claim.field === a || claim.field === b
      )?.find((f) => f !== claim.field);
      const rival = rivalField ? fieldToColumn.get(rivalField) : undefined;
      if (rival && rival.confidence > claim.confidence + AMBIGUITY_MARGIN) continue;
    }

    fieldToColumn.set(claim.field, claim);
    takenColumns.add(claim.column);
  }

  const mapping: ColumnMappingDict = {};
  const resolutions: FieldResolution[] = [];

  for (const field of CANONICAL_FIELDS) {
    const winner = fieldToColumn.get(field.key);

    // Runners-up: other columns that also claimed this field and lost.
    const alternatives = claims
      .filter(
        (c) =>
          c.field === field.key &&
          c.column !== winner?.column &&
          c.confidence >= ACCEPT_THRESHOLD * 0.6
      )
      .slice(0, 3)
      .map((c) => ({ column: c.column, confidence: Math.round(c.confidence) }));

    if (winner) mapping[field.key] = winner.column;

    resolutions.push({
      field: field.key,
      label: field.label,
      column: winner?.column ?? null,
      confidence: winner ? Math.round(winner.confidence) : 0,
      evidence: winner?.profile.hypotheses.find((h) => h.field === field.key)?.evidence ?? [
        {
          source: "VALUE_PATTERN",
          detail: "No column in this workbook carries evidence for this field",
          weight: 0,
        },
      ],
      alternatives,
      required: field.required,
    });
  }

  const unmappedColumns = profiles.map((p) => p.header).filter((h) => !takenColumns.has(h));

  return { mapping, resolutions, unmappedColumns };
}
