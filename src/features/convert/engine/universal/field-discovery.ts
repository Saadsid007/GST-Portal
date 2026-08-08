import { CANONICAL_FIELDS } from "@/features/convert/engine/mapping/mapping.templates";
import type { ColumnProfile, Evidence, FieldHypothesis, ReconstructedTable } from "./types";
import {
  GST_SLABS,
  looksLikeDate,
  looksLikeGstin,
  looksLikeGstRate,
  looksLikeHsn,
  looksLikeName,
  looksLikeReference,
  looksLikeState,
  looksNumeric,
  parseNumeric,
  rateOf,
} from "./signals";

/**
 * Layer 3 — universal field discovery.
 *
 * Every column is scored against every canonical field, producing ranked
 * competing hypotheses rather than a single answer. Header text and cell values
 * are separate lines of evidence: a header can carry a field on its own only
 * when the values do not contradict it, and values can carry a field with no
 * usable header at all.
 *
 * No marketplace template participates. The alias lists are shared vocabulary,
 * not per-platform configuration.
 */

/** Rows sampled per column. Enough to be representative, cheap on 100k-row files. */
const SAMPLE_SIZE = 200;

/**
 * Fields whose values are identical in shape to another field's, so a header is
 * the only thing that can tell them apart.
 */
const HEADER_REQUIRED_FIELDS = new Set([
  "originalInvoiceNumber",
  "ecoGstin",
  "ecoName",
  "cessRate",
  "cessAmount",
]);

type ValueScorer = (samples: string[], profile: BaseProfile) => Evidence[];

interface BaseProfile {
  header: string;
  index: number;
  samples: string[];
  fillRate: number;
  uniqueness: number;
  numericRate: number;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Contribution of a detector: full weight at total agreement, nothing below half. */
function agreement(rate: number, weight: number): number {
  if (rate < 0.5) return 0;
  return ((rate - 0.5) / 0.5) * weight;
}

/** Statistics of the numeric values in a column, used for magnitude reasoning. */
function numericStats(samples: string[]): {
  count: number;
  mean: number;
  max: number;
  negatives: number;
} {
  let count = 0;
  let sum = 0;
  let max = 0;
  let negatives = 0;
  for (const sample of samples) {
    const num = parseNumeric(sample);
    if (num === null) continue;
    count++;
    sum += num;
    max = Math.max(max, Math.abs(num));
    if (num < 0) negatives++;
  }
  return { count, mean: count === 0 ? 0 : sum / count, max, negatives };
}

/**
 * Value-level scorers per canonical field.
 *
 * Each returns evidence, positive or negative. Negative evidence matters as
 * much as positive: it is what stops a confidently-named column being bound to
 * a field whose values it cannot possibly hold.
 */
function gstinEvidence(samples: string[]): Evidence[] {
  const rate = rateOf(samples, looksLikeGstin);
  // B2C exports leave the GSTIN blank on most rows, so even a low hit rate is
  // decisive as long as what is present is genuinely a GSTIN.
  if (rate > 0.02) {
    return [
      {
        source: "VALUE_PATTERN",
        detail: `${Math.round(rate * 100)}% of values match the 15-character GSTIN structure`,
        weight: Math.min(45, 20 + rate * 30),
      },
    ];
  }
  return [{ source: "VALUE_PATTERN", detail: "No value matches the GSTIN structure", weight: -35 }];
}

function personNameEvidence(samples: string[]): Evidence[] {
  const nameRate = rateOf(samples, looksLikeName);
  const gstinRate = rateOf(samples, looksLikeGstin);
  const evidence: Evidence[] = [];
  if (gstinRate > 0.05) {
    evidence.push({
      source: "VALUE_PATTERN",
      detail: "Column holds GSTINs, so it identifies the party rather than naming it",
      weight: -45,
    });
  }
  evidence.push(
    nameRate >= 0.5
      ? {
          source: "VALUE_PATTERN",
          detail: `${Math.round(nameRate * 100)}% of values are free text`,
          weight: agreement(nameRate, 25),
        }
      : { source: "VALUE_PATTERN", detail: "Values are not free text", weight: -30 }
  );
  return evidence;
}

const VALUE_SCORERS: Record<string, ValueScorer> = {
  buyerGstin: (samples) => gstinEvidence(samples),

  ecoGstin: (samples) => gstinEvidence(samples),

  hsnCode: (samples, profile) => {
    const rate = rateOf(samples, looksLikeHsn);
    const dateRate = rateOf(samples, looksLikeDate);
    const evidence: Evidence[] = [
      rate >= 0.5
        ? {
            source: "VALUE_PATTERN",
            detail: `${Math.round(rate * 100)}% of values are 4, 6 or 8 digit codes`,
            weight: agreement(rate, 40),
          }
        : { source: "VALUE_PATTERN", detail: "Values are not HSN-shaped codes", weight: -30 },
    ];
    if (dateRate > 0.3) {
      evidence.push({
        source: "VALUE_PATTERN",
        detail: "Values also parse as dates, which HSN codes never do",
        weight: -40,
      });
    }
    // A four-digit amount is shaped exactly like a four-digit HSN code. What
    // separates them is repetition: a seller lists a handful of commodity codes
    // across thousands of rows, so an all-distinct column is an identifier or a
    // measure, not a classification.
    if (profile.uniqueness > 0.8 && samples.length >= 3) {
      evidence.push({
        source: "UNIQUENESS",
        detail: `${Math.round(profile.uniqueness * 100)}% distinct values — a commodity classification repeats across rows`,
        weight: -25,
      });
    }
    return evidence;
  },

  placeOfSupply: (samples) => {
    const rate = rateOf(samples, looksLikeState);
    return rate >= 0.5
      ? [
          {
            source: "VALUE_PATTERN",
            detail: `${Math.round(rate * 100)}% of values resolve to a notified state`,
            weight: agreement(rate, 45),
          },
        ]
      : [
          {
            source: "VALUE_PATTERN",
            detail: "Values do not resolve to Indian states",
            weight: -35,
          },
        ];
  },

  invoiceDate: (samples) => {
    const rate = rateOf(samples, looksLikeDate);
    return rate >= 0.5
      ? [
          {
            source: "VALUE_PATTERN",
            detail: `${Math.round(rate * 100)}% of values parse as dates`,
            weight: agreement(rate, 45),
          },
        ]
      : [{ source: "VALUE_PATTERN", detail: "Values do not parse as dates", weight: -40 }];
  },

  invoiceNumber: (samples, profile) => {
    const evidence: Evidence[] = [];
    const refRate = rateOf(samples, looksLikeReference);
    if (refRate >= 0.7) {
      evidence.push({
        source: "VALUE_PATTERN",
        detail: `${Math.round(refRate * 100)}% of values look like document references`,
        weight: agreement(refRate, 25),
      });
    } else {
      evidence.push({
        source: "VALUE_PATTERN",
        detail: "Values are not reference-shaped",
        weight: -35,
      });
    }
    // An invoice number is close to unique. A status or state column is not.
    if (profile.uniqueness > 0.6) {
      evidence.push({
        source: "UNIQUENESS",
        detail: `${Math.round(profile.uniqueness * 100)}% distinct values, consistent with a document identifier`,
        weight: 20 * profile.uniqueness,
      });
    } else if (profile.uniqueness < 0.2) {
      evidence.push({
        source: "UNIQUENESS",
        detail: "Values repeat heavily, so the column identifies a category rather than a document",
        weight: -25,
      });
    }
    if (profile.numericRate > 0.9 && profile.uniqueness < 0.9) {
      evidence.push({
        source: "VALUE_DISTRIBUTION",
        detail: "Purely numeric with repeats, more consistent with a measure than an identifier",
        weight: -10,
      });
    }
    return evidence;
  },

  originalInvoiceNumber: (samples, profile) => VALUE_SCORERS.invoiceNumber!(samples, profile),

  buyerName: (samples) => personNameEvidence(samples),

  ecoName: (samples) => personNameEvidence(samples),

  itemDescription: (samples, profile) => {
    const nameRate = rateOf(samples, looksLikeName);
    if (nameRate < 0.5) {
      return [{ source: "VALUE_PATTERN", detail: "Values are not descriptive text", weight: -30 }];
    }
    const avgLength = samples.reduce((n, s) => n + s.length, 0) / Math.max(1, samples.length);
    const evidence: Evidence[] = [
      {
        source: "VALUE_PATTERN",
        detail: `${Math.round(nameRate * 100)}% of values are free text`,
        weight: agreement(nameRate, 20),
      },
    ];
    // Product descriptions run long; buyer names do not.
    if (avgLength > 25) {
      evidence.push({
        source: "VALUE_DISTRIBUTION",
        detail: `Average length ${Math.round(avgLength)} characters, typical of product descriptions`,
        weight: 15,
      });
    }
    if (profile.uniqueness < 0.05) {
      evidence.push({
        source: "UNIQUENESS",
        detail: "Almost every row repeats the same text, more like a status than a description",
        weight: -20,
      });
    }
    return evidence;
  },

  uqc: (samples, profile) => {
    if (profile.uniqueness > 0.2) {
      return [
        { source: "UNIQUENESS", detail: "Too many distinct values to be a unit code", weight: -25 },
      ];
    }
    const unitLike = rateOf(samples, (v) => /^[A-Za-z]{2,6}$/.test(v.trim()));
    return unitLike >= 0.5
      ? [
          {
            source: "VALUE_PATTERN",
            detail: "Short alphabetic codes drawn from a small set, consistent with a unit",
            weight: agreement(unitLike, 25),
          },
        ]
      : [{ source: "VALUE_PATTERN", detail: "Values are not unit codes", weight: -20 }];
  },

  quantity: (samples, profile) => {
    if (profile.numericRate < 0.8) {
      return [{ source: "VALUE_PATTERN", detail: "Column is not numeric", weight: -40 }];
    }
    const stats = numericStats(samples);
    const integers = rateOf(samples, (v) => {
      const num = parseNumeric(v);
      return num !== null && Number.isInteger(num);
    });
    const evidence: Evidence[] = [];
    // Quantities are small whole numbers. Amounts are neither.
    if (integers > 0.9 && stats.max <= 10000) {
      evidence.push({
        source: "VALUE_DISTRIBUTION",
        detail: `Whole numbers with a maximum of ${stats.max}, consistent with unit counts`,
        weight: 30,
      });
    } else {
      evidence.push({
        source: "VALUE_DISTRIBUTION",
        detail: "Values carry decimals or are too large to be unit counts",
        weight: -20,
      });
    }
    return evidence;
  },

  taxableValue: (samples, profile) => moneyEvidence(samples, profile, "taxable amounts"),
  totalValue: (samples, profile) => moneyEvidence(samples, profile, "invoice totals"),
  cgstAmount: (samples, profile) => moneyEvidence(samples, profile, "tax amounts"),
  sgstAmount: (samples, profile) => moneyEvidence(samples, profile, "tax amounts"),
  igstAmount: (samples, profile) => moneyEvidence(samples, profile, "tax amounts"),
  cessAmount: (samples, profile) => moneyEvidence(samples, profile, "cess amounts"),

  cgstRate: (samples, profile) => rateEvidence(samples, profile),
  sgstRate: (samples, profile) => rateEvidence(samples, profile),
  igstRate: (samples, profile) => rateEvidence(samples, profile),
  cessRate: (samples, profile) => rateEvidence(samples, profile),
};

function moneyEvidence(samples: string[], profile: BaseProfile, label: string): Evidence[] {
  if (profile.numericRate < 0.8) {
    return [{ source: "VALUE_PATTERN", detail: "Column is not numeric", weight: -40 }];
  }
  const evidence: Evidence[] = [
    {
      source: "VALUE_PATTERN",
      detail: `${Math.round(profile.numericRate * 100)}% numeric, consistent with ${label}`,
      weight: agreement(profile.numericRate, 25),
    },
  ];
  const stats = numericStats(samples);
  // A money column that only ever holds slab values is a rate column mislabelled.
  const slabRate = rateOf(samples, looksLikeGstRate);
  if (slabRate > 0.9 && stats.max <= 28) {
    evidence.push({
      source: "VALUE_DISTRIBUTION",
      detail: "Every value sits on a GST slab, so this is a rate rather than an amount",
      weight: -30,
    });
  }
  return evidence;
}

function rateEvidence(samples: string[], profile: BaseProfile): Evidence[] {
  const slabRate = rateOf(samples, looksLikeGstRate);
  if (slabRate >= 0.7) {
    return [
      {
        source: "GST_RULE",
        detail: `${Math.round(slabRate * 100)}% of values sit exactly on a notified GST slab`,
        weight: agreement(slabRate, 45),
      },
    ];
  }
  if (profile.numericRate < 0.8) {
    return [{ source: "VALUE_PATTERN", detail: "Column is not numeric", weight: -40 }];
  }
  return [
    {
      source: "GST_RULE",
      detail: "Numeric values do not land on GST slabs",
      weight: -35,
    },
  ];
}

/** Header-derived evidence, scored by how specific the match is. */
function headerEvidence(header: string, field: (typeof CANONICAL_FIELDS)[number]): Evidence[] {
  const normalisedHeader = normalise(header);
  const headerTokens = tokenize(header);

  if (normalisedHeader === normalise(field.key) || normalisedHeader === normalise(field.label)) {
    return [{ source: "HEADER_EXACT", detail: `Header is exactly "${field.label}"`, weight: 55 }];
  }

  for (const alias of field.aliases) {
    if (normalise(alias) === normalisedHeader) {
      return [
        { source: "HEADER_ALIAS", detail: `Header matches the known alias "${alias}"`, weight: 50 },
      ];
    }
  }

  // Every token of an alias present as a whole token: "total tax amount"
  // contains "tax amount", but "eco_tcs_gstin" does not contain "sgst".
  for (const alias of field.aliases) {
    const aliasTokens = tokenize(alias);
    if (aliasTokens.length > 0 && aliasTokens.every((t) => headerTokens.includes(t))) {
      return [
        {
          source: "HEADER_TOKEN",
          detail: `Header contains every word of "${alias}"`,
          weight: 38,
        },
      ];
    }
  }

  // Weak partial overlap. Enough to break a tie, never enough to decide alone.
  let best = 0;
  let bestAlias = "";
  for (const alias of field.aliases) {
    const aliasTokens = tokenize(alias);
    if (aliasTokens.length === 0) continue;
    const shared = aliasTokens.filter((t) => headerTokens.includes(t)).length / aliasTokens.length;
    if (shared > best) {
      best = shared;
      bestAlias = alias;
    }
  }
  if (best >= 0.5) {
    return [
      {
        source: "HEADER_FUZZY",
        detail: `Header partially overlaps "${bestAlias}"`,
        weight: 12 * best,
      },
    ];
  }
  return [];
}

/**
 * Distinguishes the three tax components when the header alone is ambiguous.
 *
 * IGST and CGST/SGST are mutually exclusive on a row, and CGST equals SGST.
 * Those two facts identify the columns even when they are named "Tax 1",
 * "Tax 2", "Tax 3".
 */
function taxComponentEvidence(
  field: string,
  profile: BaseProfile,
  siblings: BaseProfile[]
): Evidence[] {
  if (!["cgstAmount", "sgstAmount", "igstAmount"].includes(field)) return [];
  if (profile.numericRate < 0.8) return [];

  const values = profile.samples.map(parseNumeric);
  const nonZero = values.filter((v) => v !== null && v !== 0).length;
  if (nonZero === 0) return [];

  for (const sibling of siblings) {
    if (sibling.index === profile.index || sibling.numericRate < 0.8) continue;
    const other = sibling.samples.map(parseNumeric);

    let equalPairs = 0;
    let comparable = 0;
    let exclusive = 0;
    const length = Math.min(values.length, other.length);
    for (let i = 0; i < length; i++) {
      const a = values[i];
      const b = other[i];
      if (a === null || b === null || a === undefined || b === undefined) continue;
      comparable++;
      if (a !== 0 && Math.abs(a - b) < 0.02) equalPairs++;
      if ((a === 0) !== (b === 0)) exclusive++;
    }
    if (comparable < 5) continue;

    // CGST and SGST are equal on every row by construction.
    if (equalPairs / comparable > 0.9 && field !== "igstAmount") {
      return [
        {
          source: "NEIGHBOURING_COLUMN",
          detail: `Values equal "${sibling.header}" on every row, the defining property of the CGST/SGST pair`,
          weight: 25,
        },
      ];
    }
    // IGST is non-zero exactly where CGST/SGST are zero.
    if (exclusive / comparable > 0.9 && field === "igstAmount") {
      return [
        {
          source: "NEIGHBOURING_COLUMN",
          detail: `Non-zero exactly where "${sibling.header}" is zero, the intra/inter-state split`,
          weight: 25,
        },
      ];
    }
  }
  return [];
}

/** Paired numeric readings of two columns, aligned by row. */
function alignedPairs(a: BaseProfile, b: BaseProfile): [number, number][] {
  const pairs: [number, number][] = [];
  const length = Math.min(a.samples.length, b.samples.length);
  for (let i = 0; i < length; i++) {
    const left = parseNumeric(a.samples[i] ?? "");
    const right = parseNumeric(b.samples[i] ?? "");
    if (left === null || right === null) continue;
    pairs.push([left, right]);
  }
  return pairs;
}

/**
 * Tells the money columns apart by how they relate to each other.
 *
 * Header text cannot separate "Assessable Value" from "Tax Charged" from
 * "Invoice Total" in a file that uses none of the expected vocabulary — but GST
 * arithmetic can, because the three are bound together by law:
 *
 *   tax ÷ taxable  lands on a notified slab
 *   total          equals taxable + tax
 *   taxable > tax  on essentially every row
 *
 * A column that plays one of those roles against a sibling is that role, and no
 * header is needed to establish it.
 */
function moneyRelationshipEvidence(
  field: string,
  profile: BaseProfile,
  siblings: BaseProfile[]
): Evidence[] {
  const MONEY_FIELDS = ["taxableValue", "totalValue", "cgstAmount", "sgstAmount", "igstAmount"];
  if (!MONEY_FIELDS.includes(field)) return [];
  if (profile.numericRate < 0.8 || profile.samples.length < 3) return [];

  const numericSiblings = siblings.filter(
    (s) => s.index !== profile.index && s.numericRate >= 0.8 && s.samples.length >= 3
  );

  for (const sibling of numericSiblings) {
    const pairs = alignedPairs(profile, sibling);
    if (pairs.length < 3) continue;

    let selfIsTax = 0;
    let selfIsBase = 0;
    for (const [self, other] of pairs) {
      if (self === 0 || other === 0) continue;
      if (snapToSlabPercent(Math.abs(self / other) * 100)) selfIsTax++;
      if (snapToSlabPercent(Math.abs(other / self) * 100)) selfIsBase++;
    }

    const usable = pairs.filter(([s, o]) => s !== 0 && o !== 0).length;
    if (usable < 3) continue;

    if (selfIsTax / usable > 0.8 && selfIsTax > selfIsBase) {
      if (field === "taxableValue" || field === "totalValue") {
        return [
          {
            source: "ARITHMETIC",
            detail: `Values are a fixed GST slab percentage of "${sibling.header}", so this column is tax rather than a base or total`,
            weight: -35,
          },
        ];
      }
      return [
        {
          source: "GST_RULE",
          detail: `Every value is exactly a notified slab percentage of "${sibling.header}", the defining relationship between tax and taxable value`,
          weight: 35,
        },
      ];
    }

    if (selfIsBase / usable > 0.8 && selfIsBase > selfIsTax) {
      if (field === "taxableValue") {
        return [
          {
            source: "GST_RULE",
            detail: `"${sibling.header}" is exactly a notified slab percentage of this column, so this is the value the tax was charged on`,
            weight: 40,
          },
        ];
      }
      if (field !== "totalValue") {
        return [
          {
            source: "ARITHMETIC",
            detail: `Tax is charged on this column rather than derived from it, so it is a base rather than a tax amount`,
            weight: -30,
          },
        ];
      }
    }
  }

  // A column equal to the sum of two others is the invoice total.
  if (field === "totalValue") {
    for (const base of numericSiblings) {
      for (const tax of numericSiblings) {
        if (base.index === tax.index) continue;
        const withBase = alignedPairs(profile, base);
        const withTax = alignedPairs(profile, tax);
        const length = Math.min(withBase.length, withTax.length);
        if (length < 3) continue;

        let sums = 0;
        for (let i = 0; i < length; i++) {
          const total = withBase[i]?.[0];
          const baseValue = withBase[i]?.[1];
          const taxValue = withTax[i]?.[1];
          if (total === undefined || baseValue === undefined || taxValue === undefined) continue;
          if (Math.abs(total - (baseValue + taxValue)) <= 0.02) sums++;
        }
        if (sums / length > 0.9) {
          return [
            {
              source: "ARITHMETIC",
              detail: `Equals "${base.header}" plus "${tax.header}" on every row, which makes it the invoice total`,
              weight: 40,
            },
          ];
        }
      }
    }
  }

  // Magnitude tiebreak, reached only when no arithmetic relationship settled
  // the column. Tax is a fraction of the base it is charged on, so among the
  // money columns the largest is a base or a total and never a tax component.
  // Deliberately small: this breaks ties, it does not decide them.
  // Constant columns are excluded from the comparison: an HSN code repeated on
  // every row is a large number but it is not money, and letting it set the
  // ceiling would stop the real amount column ever looking like the largest.
  const varying = numericSiblings.filter((s) => new Set(s.samples).size > 1);
  if (new Set(profile.samples).size > 1) {
    const selfMax = numericStats(profile.samples).max;
    const isLargest = varying.every((s) => numericStats(s.samples).max <= selfMax);
    if (isLargest) {
      return field === "taxableValue" || field === "totalValue"
        ? [
            {
              source: "VALUE_DISTRIBUTION",
              detail: "Largest of the numeric columns, so it is a base or total rather than a tax",
              weight: 8,
            },
          ]
        : [
            {
              source: "VALUE_DISTRIBUTION",
              detail: "Largest of the numeric columns, which a tax component never is",
              weight: -8,
            },
          ];
    }
  }

  return [];
}

/**
 * True when a computed ratio sits on a mainstream GST slab.
 *
 * The 0.1% and 0.25% slabs are excluded here even though they are real. They
 * are rare enough to be irrelevant to column identification, and admitting them
 * means any ratio near zero looks like a tax relationship — an HSN code divided
 * by an amount lands at 0.16%, which was enough to make a code column read as a
 * tax base.
 */
function snapToSlabPercent(percent: number): boolean {
  if (percent < 1) return false;
  return GST_SLABS.some((slab) => slab >= 1 && Math.abs(slab - percent) <= 0.1);
}

function profileColumn(table: ReconstructedTable, header: string, index: number): BaseProfile {
  const scanned = table.rows.slice(0, SAMPLE_SIZE);
  const raw = scanned.map((row) => (row[header] ?? "").trim());
  const samples = raw.filter((value) => value !== "");
  const distinct = new Set(samples).size;

  return {
    header,
    index,
    samples,
    fillRate: scanned.length === 0 ? 0 : samples.length / scanned.length,
    uniqueness: samples.length === 0 ? 0 : distinct / samples.length,
    numericRate: rateOf(samples, looksNumeric),
  };
}

/**
 * Profiles every column and ranks its candidate meanings.
 *
 * Header and value evidence are summed rather than short-circuited, so a header
 * that says "Invoice Date" over a column of GSTINs scores badly and loses to the
 * column that actually holds dates.
 */
export function discoverFields(table: ReconstructedTable): ColumnProfile[] {
  const baseProfiles = table.headers.map((header, index) => profileColumn(table, header, index));

  return baseProfiles.map((profile) => {
    const hypotheses: FieldHypothesis[] = [];

    for (const field of CANONICAL_FIELDS) {
      const evidence: Evidence[] = [...headerEvidence(profile.header, field)];

      const scorer = VALUE_SCORERS[field.key];
      if (scorer && profile.samples.length > 0) {
        evidence.push(...scorer(profile.samples, profile));
      }
      evidence.push(...taxComponentEvidence(field.key, profile, baseProfiles));
      evidence.push(...moneyRelationshipEvidence(field.key, profile, baseProfiles));

      // A column nobody ever filled cannot carry a field, whatever it is called.
      if (profile.fillRate === 0) {
        evidence.push({
          source: "VALUE_DISTRIBUTION",
          detail: "Column is empty in every scanned row",
          weight: -60,
        });
      }

      // Some fields are invisible to value analysis: an original invoice number
      // is shaped exactly like an invoice number, and an operator's GSTIN
      // exactly like a buyer's. Only the header can distinguish them, so
      // without one they are not candidates at all. Left ungated they steal
      // columns from the fields they imitate.
      if (HEADER_REQUIRED_FIELDS.has(field.key)) {
        const hasHeaderSignal = evidence.some(
          (e) => e.source.startsWith("HEADER_") && e.weight > 0
        );
        if (!hasHeaderSignal) continue;
      }

      const confidence = evidence.reduce((sum, item) => sum + item.weight, 0);
      if (confidence > 0) {
        hypotheses.push({ field: field.key, confidence: Math.min(100, confidence), evidence });
      }
    }

    hypotheses.sort((a, b) => b.confidence - a.confidence);

    return {
      header: profile.header,
      index: profile.index,
      samples: profile.samples.slice(0, 5),
      fillRate: profile.fillRate,
      uniqueness: profile.uniqueness,
      numericRate: profile.numericRate,
      hypotheses: hypotheses.slice(0, 4),
    };
  });
}
