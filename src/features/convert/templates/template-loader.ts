import * as fs from "fs";
import * as path from "path";

let cachedTemplateBuffer: Buffer | null = null;

/**
 * Returns the Buffer of the official GSTR-1 Excel Template V2.1.
 * Caches in memory to avoid repeated disk reads.
 */
export function getGstr1TemplateBuffer(): Buffer {
  if (cachedTemplateBuffer) {
    return cachedTemplateBuffer;
  }

  const pathsToTry = [
    path.join(process.cwd(), "public/templates/GSTR1_Excel_Workbook_Template_V2.1.xlsx"),
    path.join(process.cwd(), "src/features/convert/templates/GSTR1_Excel_Workbook_Template_V2.1.xlsx"),
    path.join(process.cwd(), "Sample/GSTR1_Excel_Workbook_Template_V2.1.xlsx"),
    path.resolve(__dirname, "GSTR1_Excel_Workbook_Template_V2.1.xlsx"),
  ];

  for (const p of pathsToTry) {
    try {
      if (fs.existsSync(p)) {
        cachedTemplateBuffer = fs.readFileSync(p);
        return cachedTemplateBuffer;
      }
    } catch {
      // Continue to next path
    }
  }

  throw new Error("GSTR1_Excel_Workbook_Template_V2.1.xlsx not found in any template search path");
}
