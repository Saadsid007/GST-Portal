"use server";

import { readWorkbookSafely } from "@/features/convert/utils/workbook.utils";
import { requireSession } from "@/features/auth";
import { TcsReconciler } from "@/features/convert/engine/tcs/tcs.reconciler";
import { parsePortalGstr1 } from "@/features/convert/engine/tcs/portal-gstr1.parser";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

export async function reconcileTcsAction(gstr1Rows: NormalizedInvoiceRow[], tcsFile: File) {
  await requireSession();

  const buffer = Buffer.from(await tcsFile.arrayBuffer());
  const { workbook } = readWorkbookSafely(buffer, { raw: true });

  // Use the dedicated GSTR-1 portal parser which handles:
  // • 3-row summary header offset per sheet
  // • "06-Haryana" Place Of Supply format
  // • Aggregation across B2B, B2CS, B2CL, CDNR, CDNUR sheets
  const portalRows = parsePortalGstr1(workbook);

  if (portalRows.length === 0) {
    return {
      success: false as const,
      error:
        "Could not read any state-wise data from the uploaded file. Please upload the GSTR-1 Excel exported from the GST Portal (containing sheets: B2B, B2C Small, etc.).",
    };
  }

  const result = TcsReconciler.reconcilePortal(gstr1Rows, portalRows);

  return {
    success: true as const,
    data: result,
  };
}
