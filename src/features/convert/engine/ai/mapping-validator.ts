import { CANONICAL_FIELDS } from "@/features/convert/engine/universal/canonical-fields";
import type { ColumnMappingDict } from "@/features/convert/engine/universal/canonical-fields";
import type { ColumnProfile } from "@/features/convert/engine/universal/types";

/**
 * Checks what a model proposed before any of it reaches a return.
 *
 * A language model answers every question it is asked, with the same
 * confident tone whether it recognised the column or guessed. Nothing in the
 * proposal distinguishes the two: there is no score, no abstention, and when
 * two models disagreed the earlier code silently kept the first one's answer.
 *
 * So the proposal is treated as a suggestion to be corroborated, never as a
 * decision. Each claim is checked against three things the model cannot argue
 * with — the columns that actually exist, the values inside them, and the
 * other claims in the same proposal. Anything that fails is dropped, and
 * dropping it is what makes the engine ask the user instead.
 *
 * Rejecting is always safe: an unbound field becomes a question. Accepting a
 * wrong one produces a filed return that looks complete.
 */

export interface RejectedMapping {
  header: string;
  field: string;
  /** Shown to the user, so a rejection is explainable rather than mysterious. */
  reason: string;
}

export interface ValidatedMapping {
  accepted: ColumnMappingDict;
  rejected: RejectedMapping[];
}

/** Below this the engine's own reading of the values is not worth weighing. */
const EVIDENCE_FLOOR = 45;

/**
 * How far ahead the engine's own answer must be before it overrules the model.
 *
 * Not zero: the engine is a scorer, not an oracle, and a narrow lead is noise.
 * A wide one means the values in the column say something quite different from
 * what the model read in its name.
 */
const OVERRULE_MARGIN = 25;

const VALID_FIELDS = new Set(CANONICAL_FIELDS.map((f) => f.key));

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function validateAiMapping(
  headerToField: Record<string, string | null>,
  profiles: ColumnProfile[],
  options: { disagreedHeaders?: string[] } = {}
): ValidatedMapping {
  const accepted: ColumnMappingDict = {};
  const rejected: RejectedMapping[] = [];

  const profileByHeader = new Map(profiles.map((p) => [normalise(p.header), p]));
  const disagreed = new Set((options.disagreedHeaders ?? []).map(normalise));

  // Field -> the claims competing for it, so a collision is decided once with
  // all candidates in view rather than by whichever happened to come last.
  const claims = new Map<string, { header: string; support: number }[]>();

  for (const [header, field] of Object.entries(headerToField)) {
    if (!field) continue;

    if (!VALID_FIELDS.has(field)) {
      rejected.push({ header, field, reason: `"${field}" is not a GST field this engine fills` });
      continue;
    }

    const profile = profileByHeader.get(normalise(header));
    if (!profile) {
      // The model named a column that is not in the file. Binding it would
      // read undefined into the return for every row.
      rejected.push({ header, field, reason: "No column with this name exists in the file" });
      continue;
    }

    if (disagreed.has(normalise(header))) {
      rejected.push({
        header,
        field,
        reason: "The two models read this column differently, so it needs your decision",
      });
      continue;
    }

    const top = profile.hypotheses[0];
    const support = profile.hypotheses.find((h) => h.field === field)?.confidence ?? 0;

    // The values disagree with the name. A column of dates proposed as a
    // taxable value is the kind of claim that survives header-only reasoning.
    if (
      top &&
      top.field !== field &&
      top.confidence >= EVIDENCE_FLOOR &&
      top.confidence - support >= OVERRULE_MARGIN
    ) {
      rejected.push({
        header,
        field,
        reason: `The values in this column look like ${top.field}, not ${field}`,
      });
      continue;
    }

    const existing = claims.get(field) ?? [];
    existing.push({ header, support });
    claims.set(field, existing);
  }

  for (const [field, candidates] of claims) {
    if (candidates.length === 1) {
      accepted[field] = candidates[0]!.header;
      continue;
    }

    // Two columns cannot both be the invoice number. The one the values back
    // wins; the rest are reported so the user can see the choice was made.
    const sorted = [...candidates].sort((a, b) => b.support - a.support);
    const [winner, ...losers] = sorted;

    // Nothing separates them, so nothing should be chosen for the user.
    if (winner!.support === losers[0]!.support) {
      for (const candidate of sorted) {
        rejected.push({
          header: candidate.header,
          field,
          reason: `${sorted.length} columns were proposed as ${field} and nothing distinguishes them`,
        });
      }
      continue;
    }

    accepted[field] = winner!.header;
    for (const loser of losers) {
      rejected.push({
        header: loser.header,
        field,
        reason: `"${winner!.header}" was a better match for ${field}`,
      });
    }
  }

  return { accepted, rejected };
}

/**
 * Headers the two models mapped to different fields.
 *
 * Disagreement is the one honest confidence signal a pair of models gives for
 * free, and it was being discarded: when synthesis failed the code kept the
 * first model's answer without recording that the second had said otherwise.
 */
export function findDisagreements(
  a: { excelHeader: string; canonicalKey: string | null }[],
  b: { excelHeader: string; canonicalKey: string | null }[]
): string[] {
  const byHeader = new Map(b.map((m) => [normalise(m.excelHeader), m.canonicalKey]));
  const out: string[] = [];

  for (const item of a) {
    const other = byHeader.get(normalise(item.excelHeader));
    // A header only one model mentioned is not a disagreement; it is silence.
    if (other === undefined) continue;
    if (other !== item.canonicalKey) out.push(item.excelHeader);
  }

  return out;
}
