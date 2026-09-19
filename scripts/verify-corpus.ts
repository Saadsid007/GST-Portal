/**
 * Runs every sample workbook through the real import pipeline and reports what
 * came out.
 *
 * This is the regression corpus. The sample folders are not a tidy test set —
 * each one is a different business with a different mix of marketplaces, own
 * invoices and stock transfers, and most of them also contain the return the CA
 * actually filed. That makes them the only ground truth we have, and running
 * against all of them is the only way to know that a fix for one seller did not
 * break another.
 *
 * It reads; it never writes into `Sample/`.
 *
 * Run: pnpm verify:corpus            (all folders)
 *      pnpm verify:corpus "new 19"   (one folder)
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, relative, basename } from "node:path";

import * as XLSX from "xlsx";

import { ImportSessionManager } from "@/features/convert/engine/pipeline/import-session.manager";
import { reconstructWorkbook } from "@/features/convert/engine/universal/table-reconstructor";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

const SAMPLE_DIR = "Sample";
const READABLE = new Set([".xlsx", ".xls", ".csv"]);

/**
 * Files the pipeline consumes versus files it is measured against. A GSTR-1
 * workbook in a sample folder is the CA's filed return, not something a user
 * would upload for conversion — feeding it back in would just re-import our own
 * answer and prove nothing.
 */
const REFERENCE_PATTERNS = [
  /^GSTR1_Excel_Workbook_Template/i,
  /^GSTR1_Review_/i,
  /^GST_Extracted_/i,
  /^GSTR1_[0-9]{2}[A-Z]{5}/i,
  /^GSTR1-[A-Z]+-\d{4}/i,
  /^Export file\.xlsx$/i,
];

function isReference(file: string): boolean {
  return REFERENCE_PATTERNS.some((p) => p.test(basename(file)));
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** A 15-character GSTIN in a file or folder name identifies whose books these are. */
function findSupplierGstin(files: string[]): string | undefined {
  for (const file of files) {
    const match = /\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z][0-9A-Z][0-9A-Z])\b/i.exec(file);
    if (match) return match[1]!.toUpperCase();
  }
  return undefined;
}

interface FolderOutcome {
  folder: string;
  supplierGstin?: string;
  inputFiles: number;
  referenceFiles: number;
  pdfFiles: number;
  zipFiles: number;
  rows: number;
  rowsWithErrors: number;
  byPlatform: Record<string, number>;
  byCategory: Record<string, number>;
  unmappedSheets: string[];
  skippedSheets: string[];
  /** Sheets with a header row but no data under it. */
  emptySheets: string[];
  taxableTotal: number;
  taxTotal: number;
  failures: string[];
}

async function runFolder(folder: string, files: string[]): Promise<FolderOutcome> {
  const inputs = files.filter((f) => READABLE.has(extname(f).toLowerCase()) && !isReference(f));
  const outcome: FolderOutcome = {
    folder,
    supplierGstin: findSupplierGstin(files.map((f) => basename(f))),
    inputFiles: inputs.length,
    referenceFiles: files.filter((f) => READABLE.has(extname(f).toLowerCase()) && isReference(f))
      .length,
    pdfFiles: files.filter((f) => extname(f).toLowerCase() === ".pdf").length,
    zipFiles: files.filter((f) => extname(f).toLowerCase() === ".zip").length,
    rows: 0,
    rowsWithErrors: 0,
    byPlatform: {},
    byCategory: {},
    unmappedSheets: [],
    skippedSheets: [],
    emptySheets: [],
    taxableTotal: 0,
    taxTotal: 0,
    failures: [],
  };

  const tables: {
    fileId: string;
    fileName: string;
    table: ReturnType<typeof reconstructWorkbook>[number];
  }[] = [];

  for (const file of inputs) {
    try {
      const wb = XLSX.read(readFileSync(file), { type: "buffer" });
      for (const table of reconstructWorkbook(wb)) {
        // A header row with nothing under it is a real case — marketplaces
        // hand out an export for a period with no activity — and it must be
        // told apart from a file we failed to read.
        if (table.rows.length === 0 && table.headers.length > 0) {
          outcome.emptySheets.push(`${basename(file)} :: ${table.sheetName}`);
          continue;
        }
        tables.push({ fileId: relative(SAMPLE_DIR, file), fileName: basename(file), table });
      }
    } catch (error) {
      outcome.failures.push(`${basename(file)}: ${(error as Error).message}`);
    }
  }

  if (tables.length === 0) return outcome;

  let result;
  try {
    result = await ImportSessionManager.processBatch(tables, outcome.supplierGstin);
  } catch (error) {
    outcome.failures.push(`pipeline: ${(error as Error).message}`);
    return outcome;
  }

  const rows: NormalizedInvoiceRow[] = result.combinedTransactions;
  outcome.rows = rows.length;
  outcome.rowsWithErrors = rows.filter((r) => r.errors.length > 0).length;
  outcome.unmappedSheets = result.unmappedFiles.map((t) => t.sheetName);
  outcome.skippedSheets = result.skippedSheets.map((s) => `${s.sheetName} — ${s.reason}`);

  for (const row of rows) {
    const platform = row.sourcePlatformName ?? "unknown";
    outcome.byPlatform[platform] = (outcome.byPlatform[platform] ?? 0) + 1;
    outcome.byCategory[row.invoiceType] = (outcome.byCategory[row.invoiceType] ?? 0) + 1;
    outcome.taxableTotal += row.taxableValue;
    outcome.taxTotal += row.igstAmount + row.cgstAmount + row.sgstAmount;
  }

  return outcome;
}

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
const log = (line = "") => process.stdout.write(`${line}\n`);

function printOutcome(o: FolderOutcome): void {
  const head =
    `${o.folder.padEnd(12)} rows=${String(o.rows).padStart(6)}  ` +
    `err=${String(o.rowsWithErrors).padStart(5)}  ` +
    `in=${String(o.inputFiles).padStart(3)} ref=${String(o.referenceFiles).padStart(2)} ` +
    `pdf=${String(o.pdfFiles).padStart(3)} zip=${String(o.zipFiles).padStart(2)}`;
  log(head);

  if (o.supplierGstin) log(`             gstin ${o.supplierGstin}`);
  if (o.rows > 0) {
    const plat = Object.entries(o.byPlatform)
      .map(([k, v]) => `${k}:${v}`)
      .join("  ");
    const cat = Object.entries(o.byCategory)
      .sort()
      .map(([k, v]) => `${k}:${v}`)
      .join("  ");
    log(`             ${plat}`);
    log(`             ${cat}`);
    log(`             taxable ${money(o.taxableTotal)}   tax ${money(o.taxTotal)}`);
  }
  for (const sheet of [...new Set(o.unmappedSheets)].slice(0, 8)) {
    log(`             UNMAPPED  ${sheet}`);
  }
  for (const sheet of [...new Set(o.emptySheets)].slice(0, 6)) {
    log(`             EMPTY     ${sheet}`);
  }
  for (const failure of o.failures.slice(0, 6)) log(`             FAIL      ${failure}`);
}

async function main(): Promise<void> {
  if (!existsSync(SAMPLE_DIR)) {
    log(`No ${SAMPLE_DIR}/ directory here — nothing to verify.`);
    return;
  }

  const only = process.argv[2];
  const folders = readdirSync(SAMPLE_DIR).filter((e) =>
    statSync(join(SAMPLE_DIR, e)).isDirectory()
  );
  const selected = only ? folders.filter((f) => f === only) : folders;

  if (selected.length === 0) {
    log(`No folder named "${only}". Available: ${folders.join(", ")}`);
    return;
  }

  log("");
  log("=== CORPUS RUN ===");

  const outcomes: FolderOutcome[] = [];
  for (const folder of selected) {
    const files = walk(join(SAMPLE_DIR, folder));
    const outcome = await runFolder(folder, files);
    outcomes.push(outcome);
    printOutcome(outcome);
  }

  log("");
  log("=== TOTALS ===");
  const totalRows = outcomes.reduce((s, o) => s + o.rows, 0);
  const totalErr = outcomes.reduce((s, o) => s + o.rowsWithErrors, 0);
  const silent = outcomes.filter((o) => o.inputFiles > 0 && o.rows === 0);
  const failed = outcomes.filter((o) => o.failures.length > 0);

  log(`folders            ${outcomes.length}`);
  log(`rows               ${money(totalRows)}`);
  log(`rows with errors   ${money(totalErr)}`);
  log(
    `folders yielding 0 ${silent.length}${silent.length ? "  -> " + silent.map((o) => o.folder).join(", ") : ""}`
  );
  log(
    `folders failing    ${failed.length}${failed.length ? "  -> " + failed.map((o) => o.folder).join(", ") : ""}`
  );
}

void main();
