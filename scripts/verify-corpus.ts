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
import { join, extname, basename } from "node:path";

import { ImportSessionManager } from "@/features/convert/engine/pipeline/import-session.manager";
import { readWorkbook } from "@/features/convert/engine/universal/universal-import.engine";
import { expandArchive } from "@/features/convert/utils/archive.utils";
import {
  parseGstr1Buffer,
  parseGstr1Json,
} from "@/features/convert/engine/comparison/gstr1-template.parser";
import {
  Gstr1Comparator,
  toComparableRow,
} from "@/features/convert/engine/comparison/gstr1.comparator";
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

/**
 * A 15-character GSTIN in a file name identifies whose books these are.
 *
 * Lookarounds rather than `\b`: these names separate fields with underscores
 * ("GSTR1_09CDPPN1370N1ZV_072026"), and an underscore is a word character, so
 * `\b` never fires there. With `\b` the supplier came back undefined for most
 * folders, which silently disabled the B2CL pass this harness exists to check.
 */
const GSTIN_IN_NAME = /(?<![A-Z0-9])(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z][0-9A-Z][0-9A-Z])(?![A-Z0-9])/i;

function gstinIn(text: string): string | undefined {
  return GSTIN_IN_NAME.exec(text)?.[1]?.toUpperCase();
}

function findSupplierGstin(files: string[]): string | undefined {
  for (const file of files) {
    const found = gstinIn(file);
    if (found) return found;
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
  comparisons: ComparisonOutcome[];
  /** GSTINs found, when the folder holds more than one client's books. */
  multiBusiness?: string[];
}

/** How our output stands against a return the CA actually filed. */
interface ComparisonOutcome {
  against: string;
  matched: number;
  mismatched: number;
  onlyInOurs: number;
  onlyInTheirs: number;
  b2csTotalOur: number;
  b2csTotalRef: number;
}

/**
 * The CA's filed return, if the folder holds one.
 *
 * Only the government-format workbook is used. Our own review report and the
 * PDF extractor's output are also in these folders, and measuring against
 * those would be marking our own homework.
 */
const CA_RETURN_PATTERNS = [/^GSTR1_[0-9]{2}[A-Z]{5}.*\.(xlsx|json)$/i];

function findCaReturns(files: string[]): string[] {
  return files.filter((f) => CA_RETURN_PATTERNS.some((p) => p.test(basename(f))));
}

/**
 * The reference, whichever form it arrives in.
 *
 * A JSON is the file the portal itself produced, so it is the strongest
 * ground truth in the corpus — stronger than a workbook someone assembled by
 * hand. Reading only .xlsx meant the two newest folders had a filed return
 * sitting beside them and nothing compared against it.
 */
function parseCaReturn(file: string) {
  if (extname(file).toLowerCase() === ".json") {
    return parseGstr1Json(readFileSync(file, "utf8"));
  }
  return parseGstr1Buffer(readFileSync(file), basename(file));
}

/**
 * The spreadsheets a seller would actually end up uploading.
 *
 * Amazon and Flipkart hand their reports over zipped, and the product expands
 * an archive in the browser before anything is sent. A harness that ignored
 * archives saw one folder's marketplace data as simply absent and reported the
 * resulting gap as a difference against the CA — when the seller's own files
 * were sitting there, one level down.
 */
async function expandInputs(files: string[]): Promise<{ name: string; buffer: Buffer }[]> {
  const out: { name: string; buffer: Buffer }[] = [];

  for (const file of files) {
    const ext = extname(file).toLowerCase();

    if (READABLE.has(ext) && !isReference(file)) {
      out.push({ name: basename(file), buffer: readFileSync(file) });
      continue;
    }

    if (ext !== ".zip") continue;

    const blob = new File([readFileSync(file)], basename(file));
    const { files: entries } = await expandArchive(blob);
    for (const entry of entries) {
      if (isReference(entry.fileName)) continue;
      out.push({ name: entry.fileName, buffer: Buffer.from(await entry.file.arrayBuffer()) });
    }
  }

  return out;
}

async function runFolder(folder: string, files: string[]): Promise<FolderOutcome> {
  const inputs = await expandInputs(files);
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
    comparisons: [],
  };

  const tables: {
    fileId: string;
    fileName: string;
    table: ReturnType<typeof readWorkbook>[number];
  }[] = [];

  for (const input of inputs) {
    try {
      // `readWorkbook` and not a bare `XLSX.read`: it is the function the
      // upload path itself calls, and it repairs a worksheet whose declared
      // `!ref` does not describe its contents. Flipkart's generator ships
      // "A1:IV1" on sheets that hold real rows, and SheetJS trusts `!ref` —
      // so reading the file directly made this harness report a folder as
      // empty and attribute the resulting gap to the seller's data. A harness
      // that does not take the same path as the product measures the wrong
      // thing.
      for (const table of readWorkbook(input.buffer)) {
        // A header row with nothing under it is a real case — marketplaces
        // hand out an export for a period with no activity — and it must be
        // told apart from a file we failed to read.
        if (table.rows.length === 0 && table.headers.length > 0) {
          outcome.emptySheets.push(`${input.name} :: ${table.sheetName}`);
          continue;
        }
        tables.push({ fileId: input.name, fileName: input.name, table });
      }
    } catch (error) {
      outcome.failures.push(`${input.name}: ${(error as Error).message}`);
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

  // ── Measured against what the CA filed ──────────────────────────────────
  // Nothing converted means nothing to compare. A folder holding only a
  // prepared return and no source files is a legitimate case — the pipeline
  // recognises the return and declines to import it — and reporting that as a
  // difference against itself would be noise.
  if (rows.length === 0) return outcome;

  const caReturns = findCaReturns(files);
  const gstins = new Set(
    caReturns.map((f) => gstinIn(basename(f))).filter((g): g is string => Boolean(g))
  );

  // Some folders are a CA's working directory holding several clients at once.
  // Every input is then pooled into one conversion, so no single client's
  // return can match and a comparison would only produce noise.
  if (gstins.size > 1) {
    outcome.multiBusiness = [...gstins];
    return outcome;
  }

  // A return filed for a different GSTIN is a different business's books, even
  // when it shares a folder with ours.
  const [caGstin] = gstins;
  if (caGstin && outcome.supplierGstin && caGstin !== outcome.supplierGstin) {
    outcome.multiBusiness = [outcome.supplierGstin, caGstin];
    return outcome;
  }

  const comparable = rows.map(toComparableRow);
  for (const caFile of caReturns) {
    try {
      const reference = parseCaReturn(caFile);
      const refCount =
        reference.b2b.length +
        reference.b2cs.length +
        reference.b2cl.length +
        reference.cdnr.length;

      // A blank government template sits in several folders. Comparing against
      // it says only that it is blank.
      if (refCount === 0) continue;

      const result = Gstr1Comparator.compare(comparable, reference);
      outcome.comparisons.push({
        against: basename(caFile),
        matched: result.matchedCount,
        mismatched: result.mismatchCount,
        onlyInOurs: result.onlyInOursCount,
        onlyInTheirs: result.onlyInRefCount,
        b2csTotalOur: result.b2csTotalOur,
        b2csTotalRef: result.b2csTotalRef,
      });
    } catch (error) {
      outcome.failures.push(`compare ${basename(caFile)}: ${(error as Error).message}`);
    }
  }

  // Folders keep "(1)…(5)" iterations of the same return. The last word
  // belongs to whichever version reconciles best, not to whichever sorts first.
  outcome.comparisons.sort(
    (a, b) =>
      a.mismatched + a.onlyInOurs + a.onlyInTheirs - (b.mismatched + b.onlyInOurs + b.onlyInTheirs)
  );

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
  if (o.multiBusiness) {
    log(`             MULTI-CLIENT folder (${o.multiBusiness.join(", ")}) — not compared`);
  }

  // Only the best-reconciling version is shown; the rest are earlier drafts of
  // the same return.
  const best = o.comparisons[0];
  if (best) {
    const drift = best.b2csTotalOur - best.b2csTotalRef;
    // A rupee across a whole return is rounding, not a disagreement — and
    // `drift === 0` is false for -0 anyway, which a reconciled subtraction
    // produces about half the time. The figure is printed to the paisa so a
    // sub-rupee gap is still visible rather than hidden by this tolerance.
    const clean = best.mismatched === 0 && best.onlyInOurs === 0 && Math.abs(drift) < 1;
    log(
      `             ${clean ? "MATCHES" : "DIFFERS"} vs CA ${best.against}` +
        (o.comparisons.length > 1 ? `  (best of ${o.comparisons.length} versions)` : "")
    );
    log(
      `                match=${best.matched} mismatch=${best.mismatched} ` +
        `onlyOurs=${best.onlyInOurs} onlyCA=${best.onlyInTheirs}` +
        `   B2CS drift ${drift.toFixed(2)}`
    );
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
