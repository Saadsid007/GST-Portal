import JSZip from "jszip";

/**
 * Expands a marketplace download in the browser.
 *
 * Amazon hands out the B2B and B2C MTR reports as `.zip`, and Flipkart wraps
 * its invoice bundles the same way. Until now the app rejected those outright,
 * so the first thing a seller had to do was leave the product, unzip by hand
 * and come back — with the real files buried one level down.
 *
 * Expansion happens client-side: the archive itself is never uploaded, only the
 * spreadsheets inside it, which keeps a 30 MB bundle of invoice PDFs off the
 * request entirely.
 */

const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".csv"];

/**
 * Limits. A zip can expand to far more than its own size, so an archive is
 * never trusted about how much it holds — these caps are what stops a crafted
 * or simply enormous file from exhausting the tab's memory.
 */
const MAX_ENTRIES = 64;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const MAX_SINGLE_BYTES = 40 * 1024 * 1024;

export interface ExpandedEntry {
  /** Name as it appeared inside the archive, without directories. */
  fileName: string;
  file: File;
}

export interface ExpandResult {
  files: ExpandedEntry[];
  /** Entries deliberately left behind, each with the reason. */
  skipped: { name: string; reason: string }[];
}

export function isArchive(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".zip");
}

function isSpreadsheet(name: string): boolean {
  const lower = name.toLowerCase();
  return SPREADSHEET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function baseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

/**
 * Reads every spreadsheet out of a zip.
 *
 * Non-spreadsheets are reported rather than dropped quietly: a seller who
 * uploads an archive of invoice PDFs should be told the app looked inside and
 * found nothing it could convert, not left staring at an empty slot.
 */
export async function expandArchive(archive: File): Promise<ExpandResult> {
  const zip = await JSZip.loadAsync(archive);
  const files: ExpandedEntry[] = [];
  const skipped: { name: string; reason: string }[] = [];

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  let totalBytes = 0;
  let seen = 0;

  for (const entry of entries) {
    const name = baseName(entry.name);

    // Archive metadata, not user content.
    if (entry.name.startsWith("__MACOSX/") || name.startsWith("._") || name === ".DS_Store") {
      continue;
    }

    if (++seen > MAX_ENTRIES) {
      skipped.push({ name, reason: `Archive holds more than ${MAX_ENTRIES} files` });
      break;
    }

    if (isArchive(name)) {
      // One level only. Following nested archives is how a small file turns
      // into an unbounded amount of work.
      skipped.push({ name, reason: "Nested archive — unzip this one separately" });
      continue;
    }

    if (!isSpreadsheet(name)) {
      skipped.push({ name, reason: "Not a spreadsheet" });
      continue;
    }

    const blob = await entry.async("blob");

    if (blob.size > MAX_SINGLE_BYTES) {
      skipped.push({ name, reason: "File is too large to open in the browser" });
      continue;
    }

    totalBytes += blob.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      skipped.push({ name, reason: "Archive expands beyond the size this page can hold" });
      break;
    }

    files.push({ fileName: name, file: new File([blob], name, { type: blob.type }) });
  }

  return { files, skipped };
}

/**
 * Picks the entry that belongs in a given upload slot.
 *
 * Amazon's archives name their contents unambiguously — `MTR_B2B-JULY-2026-…`,
 * `MTR_B2C-…`, `MTR_STOCK_TRANSFER-…` — so the slot a file belongs to is
 * readable from its name. Scoring rather than matching outright means a single
 * unnamed spreadsheet still lands in the slot the user dropped the zip on.
 */
export function chooseEntryForSlot(
  entries: ExpandedEntry[],
  fileTypeId: string
): ExpandedEntry | undefined {
  if (entries.length === 0) return undefined;
  if (entries.length === 1) return entries[0];

  const wanted = fileTypeId.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!wanted) return entries[0];

  const scored = entries.map((entry) => {
    const name = entry.fileName.toLowerCase().replace(/[^a-z0-9]/g, "");
    return { entry, hit: name.includes(wanted) };
  });

  return (scored.find((s) => s.hit) ?? scored[0]!).entry;
}
