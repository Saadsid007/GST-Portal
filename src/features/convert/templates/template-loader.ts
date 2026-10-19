import * as fs from "fs";
import * as path from "path";

/**
 * The official GSTR-1 Excel Workbook Template, as shipped inside the GST
 * Returns Offline Tool V3.2.4 (V2.2: adds FY 2025-26 to the period lists).
 * Writing into the government's own workbook is what lets the offline tool
 * import the file without a "Column Headers Missing/Mismatch" error.
 */
export const GSTR1_TEMPLATE_FILE = "GSTR1_Excel_Workbook_Template_V2.2.xlsx";

let cachedTemplateBuffer: Buffer | null = null;

/**
 * One location, in public/ — the deploy copies it beside the standalone
 * server. The loader used to try four, one of them under Sample/, and a path
 * built that loosely made the bundler trace the whole repository into the
 * server build.
 */
export function getGstr1TemplateBuffer(): Buffer {
  if (cachedTemplateBuffer) return cachedTemplateBuffer;
  const file = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "public",
    "templates",
    GSTR1_TEMPLATE_FILE
  );
  cachedTemplateBuffer = fs.readFileSync(file);
  return cachedTemplateBuffer;
}
