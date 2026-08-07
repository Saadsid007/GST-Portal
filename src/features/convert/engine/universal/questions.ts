import type { ClarifyingQuestion, ColumnProfile, FieldResolution } from "./types";
import { AMBIGUITY_MARGIN } from "./assignment";

/**
 * The human assistance engine.
 *
 * The user is never shown a column-mapping grid. Mapping is the engine's job,
 * and asking a seller which spreadsheet column is "taxableValue" is asking them
 * to do it. A question is raised only where reasoning genuinely could not
 * settle a field that matters, and it is phrased as a business question with
 * the engine's own reading of each option attached.
 */

/** Fields worth interrupting for. Everything else is recovered or left out. */
const CRITICAL_FIELDS = new Set(["invoiceNumber", "invoiceDate", "taxableValue", "placeOfSupply"]);

const QUESTION_TEXT: Record<string, string> = {
  invoiceNumber: "Which of these is the invoice number you file against?",
  invoiceDate: "Which date should the return be filed on?",
  taxableValue: "Which figure is the taxable value, before GST?",
  placeOfSupply: "Which location decides the place of supply?",
};

function sampleHint(profiles: ColumnProfile[], column: string): string {
  const profile = profiles.find((p) => p.header === column);
  if (!profile || profile.samples.length === 0) return "No sample values available";
  return `e.g. ${profile.samples.slice(0, 3).join(", ")}`;
}

/**
 * Raises questions for critical fields that are either unresolved, or resolved
 * by too narrow a margin over a rival column to be acted on silently.
 */
export function buildQuestions(
  resolutions: FieldResolution[],
  profiles: ColumnProfile[]
): ClarifyingQuestion[] {
  const questions: ClarifyingQuestion[] = [];

  for (const resolution of resolutions) {
    if (!CRITICAL_FIELDS.has(resolution.field)) continue;

    const contenders = resolution.alternatives.filter(
      (alt) => alt.confidence >= resolution.confidence - AMBIGUITY_MARGIN
    );

    const unresolved = resolution.column === null;
    const ambiguous = resolution.column !== null && contenders.length > 0;
    if (!unresolved && !ambiguous) continue;

    const options: ClarifyingQuestion["options"] = [];
    if (resolution.column) {
      options.push({
        value: resolution.column,
        label: resolution.column,
        hint: `${sampleHint(profiles, resolution.column)} — the engine's reading, ${resolution.confidence}% confidence`,
      });
    }
    for (const alt of contenders) {
      options.push({
        value: alt.column,
        label: alt.column,
        hint: `${sampleHint(profiles, alt.column)} — ${alt.confidence}% confidence`,
      });
    }

    // Nothing to choose between. The field is simply absent, which is a data
    // problem for validation to report, not a question anyone can answer.
    if (options.length < 2) continue;

    questions.push({
      id: `field:${resolution.field}`,
      question: QUESTION_TEXT[resolution.field] ?? `Which column carries the ${resolution.label}?`,
      field: resolution.field,
      options,
    });
  }

  return questions;
}
