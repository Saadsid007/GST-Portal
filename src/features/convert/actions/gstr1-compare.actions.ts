import { requireSession } from "@/features/auth";
import { parseGstr1Buffer } from "@/features/convert/engine/comparison/gstr1-template.parser";
import { Gstr1Comparator } from "@/features/convert/engine/comparison/gstr1.comparator";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Compares our generated GSTR-1 rows against an uploaded reference GSTR-1 file.
 *
 * Supported reference formats:
 *   - Amazon's auto-generated GSTR-1 Excel (GSTR1-*.xlsx)
 *   - Government's GSTR-1 Excel Workbook Template V2.1
 *   - Government/Tax Software GSTR-1 JSON export (GSTR1_*.json)
 *
 * The reference file is NEVER merged with our data — it is used only for comparison.
 * This enforces the rule: MTR is primary; GSTR-1 reference is validation-only.
 */
export async function compareGstr1Action(ourRows: NormalizedInvoiceRow[], referenceFile: File) {
  await requireSession();

  const buffer = Buffer.from(await referenceFile.arrayBuffer());
  const parsedRef = parseGstr1Buffer(buffer, referenceFile.name);

  const b2bCount = parsedRef.b2b.length;
  const b2csCount = parsedRef.b2cs.length;
  const b2clCount = parsedRef.b2cl.length;
  const cdnrCount = parsedRef.cdnr.length;
  const totalRefInvoices = b2bCount + b2csCount + b2clCount + cdnrCount;

  if (totalRefInvoices === 0) {
    return {
      success: false as const,
      error:
        "No GSTR-1 data found in the uploaded file. Please upload either:\n" +
        "• Amazon's auto-generated GSTR-1 Excel (GSTR1-MONTH-YEAR-*.xlsx)\n" +
        "• Government's GSTR-1 Excel Workbook Template V2.1",
    };
  }

  const result = Gstr1Comparator.compare(ourRows, parsedRef);

  return {
    success: true as const,
    data: {
      ...result,
      sourceLabel:
        parsedRef.sourceType === "amazon_gstr1"
          ? "Amazon Auto-Generated GSTR-1"
          : parsedRef.sourceType === "govt_template"
            ? "Government GSTR-1 Template V2.1"
            : "GSTR-1 Reference File",
    },
  };
}
