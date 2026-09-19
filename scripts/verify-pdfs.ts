/**
 * Runs every sample PDF through the invoice extractor and reports what it got.
 *
 * The spreadsheet corpus is measured against the CA's filed return; PDFs have
 * no such reference, so the check here is internal consistency — the arithmetic
 * an invoice must satisfy whatever its layout:
 *
 *   taxable + tax = total          the figures describe one document
 *   tax / taxable lands on a slab  the rate is one the Act actually notifies
 *   either IGST or CGST+SGST       a supply is inter-state or intra-state
 *
 * A layout the extractor misreads almost always breaks one of these, which is
 * how a wrong figure becomes visible without knowing the right one.
 *
 * Run: pnpm verify:pdfs            (all)
 *      pnpm verify:pdfs "new 19"   (one folder)
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, relative, basename } from "node:path";

import { extractTextFromPdfBuffer } from "@/features/pdf-extractor/engine/pdf-text-parser";
import { extractInvoiceFromText } from "@/features/pdf-extractor/engine/regex-invoice-extractor";

const SAMPLE_DIR = "Sample";
const GST_SLABS = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];
const PAISA = 1;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (extname(full).toLowerCase() === ".pdf") out.push(full);
  }
  return out;
}

interface Problem {
  file: string;
  issues: string[];
}

function check(inv: {
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  totalInvoiceValue: number;
  placeOfSupply: string;
  gstRate: number;
}): string[] {
  const issues: string[] = [];
  const tax = inv.igstAmount + inv.cgstAmount + inv.sgstAmount + inv.cessAmount;

  if (!inv.invoiceNumber) issues.push("no invoice number");
  if (!inv.invoiceDate) issues.push("no invoice date");
  if (!inv.placeOfSupply) issues.push("no place of supply");

  if (inv.taxableValue === 0 && inv.totalInvoiceValue === 0) {
    issues.push("no values read at all");
    return issues;
  }

  // The one identity every invoice satisfies. A layout read wrongly usually
  // takes a purchase-order number or a page total for one of these.
  const expected = inv.taxableValue + tax;
  if (Math.abs(expected - inv.totalInvoiceValue) > PAISA) {
    issues.push(
      `taxable ${inv.taxableValue} + tax ${tax.toFixed(2)} = ${expected.toFixed(2)}, ` +
        `but total reads ${inv.totalInvoiceValue}`
    );
  }

  if (inv.taxableValue > 0 && tax > 0) {
    const pct = (tax / inv.taxableValue) * 100;
    if (!GST_SLABS.some((s) => Math.abs(s - pct) <= 0.2)) {
      issues.push(`implied rate ${pct.toFixed(2)}% is not a notified slab`);
    }
  }

  // Inter-state and intra-state are exclusive; both populated means the
  // extractor read a summary table as if it were one supply.
  if (inv.igstAmount > 0 && (inv.cgstAmount > 0 || inv.sgstAmount > 0)) {
    issues.push("both IGST and CGST/SGST are populated");
  }

  if (Math.abs(inv.cgstAmount - inv.sgstAmount) > PAISA) {
    issues.push(`CGST ${inv.cgstAmount} and SGST ${inv.sgstAmount} differ`);
  }

  return issues;
}

const log = (line = "") => process.stdout.write(`${line}\n`);

async function main(): Promise<void> {
  if (!existsSync(SAMPLE_DIR)) {
    log(`No ${SAMPLE_DIR}/ directory here — nothing to verify.`);
    return;
  }

  const only = process.argv[2];
  const root = only ? join(SAMPLE_DIR, only) : SAMPLE_DIR;
  if (!existsSync(root)) {
    log(`No folder "${only}".`);
    return;
  }

  const pdfs = walk(root);
  log("");
  log(`=== PDF RUN (${pdfs.length} files) ===`);

  const problems: Problem[] = [];
  const byLayout = new Map<string, number>();
  let unreadable = 0;
  let clean = 0;

  for (const pdf of pdfs) {
    let invoice;
    try {
      const parsed = await extractTextFromPdfBuffer(readFileSync(pdf));
      invoice = extractInvoiceFromText({
        text: parsed.text,
        fileName: basename(pdf),
        fileSizeBytes: statSync(pdf).size,
        pageCount: parsed.pageCount,
      });
    } catch (error) {
      unreadable++;
      problems.push({
        file: relative(SAMPLE_DIR, pdf),
        issues: [`unreadable: ${(error as Error).message}`],
      });
      continue;
    }

    const layout = invoice.confidenceScore === 100 ? "known layout" : "generic patterns";
    byLayout.set(layout, (byLayout.get(layout) ?? 0) + 1);

    const issues = check(invoice);
    if (issues.length === 0) clean++;
    else problems.push({ file: relative(SAMPLE_DIR, pdf), issues });
  }

  log("");
  log("=== SUMMARY ===");
  log(`files          ${pdfs.length}`);
  log(`internally consistent ${clean}`);
  log(`with problems  ${problems.length}`);
  log(`unreadable     ${unreadable}`);
  for (const [layout, count] of byLayout) log(`${layout.padEnd(22)} ${count}`);

  // Grouped by the issue rather than the file: a hundred invoices of one
  // layout fail the same way, and the layout is what needs fixing.
  const byIssue = new Map<string, string[]>();
  for (const p of problems) {
    for (const issue of p.issues) {
      const key = issue.replace(/[\d.,]+/g, "N");
      const list = byIssue.get(key) ?? [];
      list.push(p.file);
      byIssue.set(key, list);
    }
  }

  log("");
  log("=== PROBLEMS BY KIND ===");
  for (const [kind, files] of [...byIssue.entries()].sort((a, b) => b[1].length - a[1].length)) {
    log(`${String(files.length).padStart(4)}x  ${kind}`);
    for (const f of files.slice(0, 3)) log(`        ${f}`);
    if (files.length > 3) log(`        …and ${files.length - 3} more`);
  }
}

void main();
