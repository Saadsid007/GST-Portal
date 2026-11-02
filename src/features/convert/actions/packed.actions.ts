"use server";

import { requireSession } from "@/features/auth";
import {
  applyAutoFixAction,
  applySuggestedHsnAction,
  applySuggestedRatesAction,
  evaluateWorkbooksAction,
  generateCaReviewReportAction,
  generateGstr1ExcelAction,
  parseMultiPlatformFilesAction,
  revalidateAllAction,
  saveConversionAction,
  updateRowAction,
} from "@/features/convert/actions/convert.actions";
import { reconcileTcsAction } from "@/features/convert/actions/tcs.actions";
import { packResult, unpackArgs } from "@/features/convert/utils/read-upload";

/**
 * The convert actions, reachable with gzipped arguments and a gzipped result.
 *
 * A month of marketplace invoices is ~800 bytes a row as JSON, so the review
 * steps passed Vercel's 4.5 MB request and response limit at roughly 5,700
 * rows, and the browser showed "An unexpected response was received from the
 * server". Compressed, the same rows are ~34x smaller.
 *
 * Only the actions listed here can be called, and each still checks the
 * session and validates its own input exactly as when called directly.
 */
const PACKED_ACTIONS = {
  evaluateWorkbooks: evaluateWorkbooksAction,
  parseMultiPlatformFiles: parseMultiPlatformFilesAction,
  applyAutoFix: applyAutoFixAction,
  applySuggestedRates: applySuggestedRatesAction,
  applySuggestedHsn: applySuggestedHsnAction,
  revalidateAll: revalidateAllAction,
  updateRow: updateRowAction,
  generateGstr1Excel: generateGstr1ExcelAction,
  generateCaReviewReport: generateCaReviewReportAction,
  saveConversion: saveConversionAction,
  reconcileTcs: reconcileTcsAction,
} as const;

export type PackedConvertActions = typeof PACKED_ACTIONS;

export async function runPackedConvertAction(
  name: string,
  payload: Blob,
  files: Blob[]
): Promise<Uint8Array> {
  // Before any decompression work: no session, no work.
  await requireSession();
  if (!Object.hasOwn(PACKED_ACTIONS, name)) throw new Error("Unknown action");

  const args = await unpackArgs(payload, files);
  if (!Array.isArray(args)) throw new Error("Invalid request");

  const action = PACKED_ACTIONS[name as keyof PackedConvertActions] as (
    ...a: unknown[]
  ) => Promise<unknown>;
  return packResult(await action(...args));
}
