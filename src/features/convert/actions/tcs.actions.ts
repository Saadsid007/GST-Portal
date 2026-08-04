"use server";

import * as XLSX from "xlsx";
import { requireSession } from "@/features/auth";
import { TcsReconciler } from "@/features/convert/engine/tcs/tcs.reconciler";
import { extractDataRows } from "@/features/convert/utils/workbook.utils";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

export async function reconcileTcsAction(gstr1Rows: NormalizedInvoiceRow[], tcsFile: File) {
  await requireSession();

  const buffer = Buffer.from(await tcsFile.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const portalTcsRows = extractDataRows(workbook);

  if (portalTcsRows.length === 0) {
    return { success: false as const, error: "TCS Excel file has no data rows" };
  }

  const result = TcsReconciler.reconcile(gstr1Rows, portalTcsRows);

  return {
    success: true as const,
    data: result,
  };
}
