/**
 * Harvests a labelled column library from the sample corpus.
 *
 * Phase 0 of the mapping-memory work. The goal is not to train anything — it is
 * to find out what we actually have. Every marketplace column in `Sample/` is
 * profiled with the existing discovery engine and labelled from the canonical
 * alias list, producing (signature -> canonical field) exemplars.
 *
 * Two things fall out of this that we cannot get any other way:
 *
 *   1. How many *independent* labelled columns the corpus really holds. Fifteen
 *      copies of one Meesho export share one header set, so they are one
 *      example repeated, not fifteen.
 *   2. A baseline. The engine already ranks hypotheses per column, so we can
 *      measure today's top-1 accuracy before changing a line of it. Any later
 *      similarity layer has to beat this number to justify itself.
 *
 * Run: pnpm harvest:columns
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";

import * as XLSX from "xlsx";

import { CANONICAL_FIELDS } from "@/features/convert/engine/universal/canonical-fields";
import { discoverFields } from "@/features/convert/engine/universal/field-discovery";
import { reconstructWorkbook } from "@/features/convert/engine/universal/table-reconstructor";
import type { ColumnProfile } from "@/features/convert/engine/universal/types";

const SAMPLE_DIR = "Sample";
const OUT_DIR = "data";
const OUT_FILE = join(OUT_DIR, "column-exemplars.json");

/**
 * Files we generate rather than consume. Harvesting our own output would teach
 * the library that our current mapping is correct by definition, which is
 * exactly the assumption the corpus exists to test.
 */
const OUTPUT_FILE_PATTERNS = [
  /^GSTR1_Excel_Workbook_Template/i,
  /^GSTR1_Review_/i,
  /^GST_Extracted_/i,
  /^GSTR1_[0-9]{2}[A-Z]{5}/i,
];

const READABLE = new Set([".xlsx", ".xls", ".csv"]);

/** A column, reduced to the shape a later matcher would compare on. */
interface ColumnSignature {
  header: string;
  tokens: string[];
  fillRate: number;
  uniqueness: number;
  numericRate: number;
  samples: string[];
}

interface Exemplar {
  /** Canonical field this column was labelled as. */
  field: string;
  signature: ColumnSignature;
  /** Fingerprint of the header set this column came from. */
  formatId: string;
  sourceFile: string;
  sheetName: string;
  /** What the current engine ranked first, and how sure it was. */
  enginePrediction: string | null;
  engineConfidence: number;
}

interface FormatRecord {
  formatId: string;
  headers: string[];
  files: string[];
  sheetName: string;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/**
 * Builds normalised-alias -> canonical-field lookup.
 *
 * An alias claimed by two fields cannot label anything on its own, so those are
 * dropped and reported rather than resolved by declaration order — silently
 * preferring whichever field is listed first would bake a coin flip into every
 * exemplar derived from it.
 */
function buildAliasIndex(): { index: Map<string, string>; collisions: string[] } {
  const claims = new Map<string, Set<string>>();

  for (const field of CANONICAL_FIELDS) {
    for (const alias of [field.key, field.label, ...field.aliases]) {
      const key = normalise(alias);
      if (!key) continue;
      const existing = claims.get(key) ?? new Set<string>();
      existing.add(field.key);
      claims.set(key, existing);
    }
  }

  const index = new Map<string, string>();
  const collisions: string[] = [];
  for (const [alias, fields] of claims) {
    if (fields.size === 1) {
      index.set(alias, [...fields][0]!);
    } else {
      collisions.push(`${alias} -> ${[...fields].join(", ")}`);
    }
  }
  return { index, collisions };
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full));
      continue;
    }
    if (!READABLE.has(extname(entry).toLowerCase())) continue;
    if (OUTPUT_FILE_PATTERNS.some((p) => p.test(basename(entry)))) continue;
    found.push(full);
  }
  return found;
}

/** Stable id for a header set, so the same export from any seller collapses to one format. */
function fingerprint(headers: string[]): string {
  const canonical = headers.map(normalise).filter(Boolean).sort().join("|");
  return createHash("sha1").update(canonical).digest("hex").slice(0, 12);
}

function toSignature(profile: ColumnProfile): ColumnSignature {
  return {
    header: profile.header,
    tokens: tokenize(profile.header),
    fillRate: Number(profile.fillRate.toFixed(3)),
    uniqueness: Number(profile.uniqueness.toFixed(3)),
    numericRate: Number(profile.numericRate.toFixed(3)),
    samples: profile.samples.slice(0, 5),
  };
}

function main(): void {
  const { index: aliasIndex, collisions } = buildAliasIndex();

  const files = walk(SAMPLE_DIR);
  const exemplars: Exemplar[] = [];
  const formats = new Map<string, FormatRecord>();
  const unlabelled = new Map<string, number>();
  const failures: string[] = [];

  for (const file of files) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(readFileSync(file), { type: "buffer", sheetRows: 200 });
    } catch (error) {
      failures.push(`${relative(SAMPLE_DIR, file)}: ${(error as Error).message}`);
      continue;
    }

    for (const table of reconstructWorkbook(workbook)) {
      if (table.headers.length < 3 || table.rows.length === 0) continue;

      const formatId = fingerprint(table.headers);
      const record = formats.get(formatId);
      if (record) {
        if (!record.files.includes(file)) record.files.push(file);
      } else {
        formats.set(formatId, {
          formatId,
          headers: table.headers,
          files: [file],
          sheetName: table.sheetName,
        });
      }

      // Only the first file of each format contributes exemplars. Later copies
      // carry identical headers over different sellers' rows; keeping them would
      // inflate the library with duplicates and quietly weight the count towards
      // whichever marketplace happened to send the most files.
      if (record) continue;

      for (const profile of discoverFields(table)) {
        const label = aliasIndex.get(normalise(profile.header));
        const top = profile.hypotheses[0];

        if (!label) {
          unlabelled.set(profile.header, (unlabelled.get(profile.header) ?? 0) + 1);
          continue;
        }

        exemplars.push({
          field: label,
          signature: toSignature(profile),
          formatId,
          sourceFile: relative(SAMPLE_DIR, file),
          sheetName: table.sheetName,
          enginePrediction: top?.field ?? null,
          engineConfidence: top ? Math.round(top.confidence) : 0,
        });
      }
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    OUT_FILE,
    JSON.stringify(
      { generatedFrom: SAMPLE_DIR, exemplars, formats: [...formats.values()] },
      null,
      2
    )
  );

  report({ files, exemplars, formats, unlabelled, collisions, failures });
}

function report(data: {
  files: string[];
  exemplars: Exemplar[];
  formats: Map<string, FormatRecord>;
  unlabelled: Map<string, number>;
  collisions: string[];
  failures: string[];
}): void {
  const { files, exemplars, formats, unlabelled, collisions, failures } = data;
  const log = (line = "") => process.stdout.write(`${line}\n`);

  log();
  log("=== CORPUS ===");
  log(`Readable input files   ${files.length}`);
  log(`Distinct formats       ${formats.size}`);
  log(`Labelled exemplars     ${exemplars.length}`);
  log(`Unlabelled columns     ${[...unlabelled.values()].reduce((a, b) => a + b, 0)}`);
  if (failures.length) log(`Unreadable             ${failures.length}`);

  log();
  log("=== EXEMPLARS PER FIELD ===");
  const perField = new Map<string, number>();
  for (const ex of exemplars) perField.set(ex.field, (perField.get(ex.field) ?? 0) + 1);
  for (const field of CANONICAL_FIELDS) {
    const count = perField.get(field.key) ?? 0;
    const bar = count === 0 ? "  (none)" : ` ${"#".repeat(Math.min(count, 40))}`;
    log(`${field.key.padEnd(22)} ${String(count).padStart(3)}${bar}`);
  }

  log();
  log("=== BASELINE: current engine top-1 ===");
  const scored = exemplars.filter((e) => e.enginePrediction !== null);
  const correct = scored.filter((e) => e.enginePrediction === e.field);
  const pct = scored.length ? ((correct.length / scored.length) * 100).toFixed(1) : "n/a";
  log(`${correct.length}/${scored.length} correct  (${pct}%)`);
  log("Any similarity layer has to beat this to be worth shipping.");

  const misses = scored.filter((e) => e.enginePrediction !== e.field);
  if (misses.length) {
    log();
    log("Top misses:");
    for (const miss of misses.slice(0, 12)) {
      log(
        `  "${miss.signature.header}" -> expected ${miss.field}, ` +
          `got ${miss.enginePrediction} (${miss.engineConfidence})`
      );
    }
  }

  const topUnlabelled = [...unlabelled.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (topUnlabelled.length) {
    log();
    log("=== UNLABELLED (alias list has no entry) ===");
    for (const [header, count] of topUnlabelled) log(`  ${String(count).padStart(3)}x  ${header}`);
  }

  if (collisions.length) {
    log();
    log("=== ALIAS COLLISIONS (dropped) ===");
    for (const c of collisions) log(`  ${c}`);
  }

  if (failures.length) {
    log();
    log("=== UNREADABLE ===");
    for (const f of failures.slice(0, 10)) log(`  ${f}`);
  }

  log();
  log(`Written: ${OUT_FILE}`);
}

main();
