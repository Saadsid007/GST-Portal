"use server";

import * as XLSX from "xlsx";
import { requireSession } from "@/features/auth";
import { shouldWatermark } from "@/features/billing/services/entitlement.service";
import { MappingEngine } from "@/features/convert/engine/mapping/mapping.engine";
import { transformMappedRows } from "@/features/convert/engine/transformation/transformation.engine";
import { RuleEngine } from "@/features/convert/engine/rules/rule.engine";
import { mergeTransactions, type ParsedFileBatch } from "@/features/convert/engine/merge.engine";
import { processNetSales } from "@/features/convert/engine/net-sales.engine";
import { validateInvoices } from "@/features/convert/domain/validator";
import { generateStatement } from "@/features/convert/engine/statement.engine";
import { generateGstr1Json } from "@/features/convert/domain/gstr1-json.generator";
import { generateGstr1Excel } from "@/features/convert/domain/gstr1-excel.generator";
import { generateCaReviewReport } from "@/features/convert/domain/ca-review-report.generator";
import { getPlatformConfig } from "@/features/convert/config/platform.config";
import { extractDataRows } from "@/features/convert/utils/workbook.utils";
import { applyAutoFixers } from "@/features/convert/engine/error-center/auto-fixers";
import {
  isConfidentSuggestion,
  suggestGstRate,
} from "@/features/convert/engine/error-center/rate-suggester";
import { applyRateToRow, revalidateRows } from "@/features/convert/engine/error-center/revalidate";
import prisma from "@/lib/prisma";
import type {
  EditableRowFields,
  NormalizedInvoiceRow,
  MultiUploadFileInput,
  NetSalesStatement,
} from "@/features/convert/types/convert.types";
import type { ColumnMappingDict } from "@/features/convert/engine/mapping/mapping.templates";

export interface FileCustomMapping {
  platformId: string;
  fileTypeId: string;
  mapping: ColumnMappingDict;
}

/**
 * Multi-Platform File Parser Action:
 * Executes the complete 10-stage pipeline with timing metrics.
 */
export async function parseMultiPlatformFilesAction(
  files: MultiUploadFileInput[],
  gstinNumber: string,
  customMappings?: FileCustomMapping[]
) {
  const session = await requireSession();
  const startTime = Date.now();

  if (!files || files.length === 0) {
    return { success: false as const, error: "No files were uploaded" };
  }

  // Read from the user's own saved mappings rather than the payload: an operator GSTIN sent from
  // the browser would land in a filed Table 14 unchecked.
  const savedOperators = await prisma.ecoOperatorGstin.findMany({
    where: { userId: session.user.id, gstinNumber },
    select: { platformId: true, ecoGstin: true },
  });
  const fallbackEcoGstins = new Map(savedOperators.map((o) => [o.platformId, o.ecoGstin]));

  const batches: ParsedFileBatch[] = [];

  for (const fileItem of files) {
    const buffer = Buffer.from(await fileItem.file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const rawRows = extractDataRows(workbook);

    if (rawRows.length === 0) continue;

    const platformConfig = getPlatformConfig(fileItem.platformId);
    const headers = Object.keys(rawRows[0] || {});

    // 1. Universal Mapping Engine
    const userCustomMapping = customMappings?.find(
      (m) => m.platformId === fileItem.platformId && m.fileTypeId === fileItem.fileTypeId
    )?.mapping;

    const mapping =
      userCustomMapping ||
      MappingEngine.autoDetectMapping(headers, fileItem.platformId, rawRows.slice(0, 10));
    const mappedRows = MappingEngine.mapRawRows(rawRows, mapping);

    // 2. Transformation Engine
    const transformedRows = transformMappedRows(mappedRows, {
      platformId: fileItem.platformId,
      platformName: platformConfig.name,
      fileName: fileItem.fileName,
      fileTypeId: fileItem.fileTypeId,
      supplierGstin: gstinNumber,
      fallbackEcoGstin: fallbackEcoGstins.get(fileItem.platformId),
    });

    // 3. Rule Engine
    const ruleCheckedRows = RuleEngine.applyRowRules(transformedRows, fileItem.platformId);

    batches.push({
      platformId: fileItem.platformId,
      platformName: platformConfig.name,
      fileName: fileItem.fileName,
      fileTypeId: fileItem.fileTypeId,
      rows: ruleCheckedRows,
    });
  }

  if (batches.length === 0) {
    return {
      success: false as const,
      error: "Could not extract data from the uploaded Excel files",
    };
  }

  // 4. Merge Engine
  const mergeResult = mergeTransactions(batches);

  // A file that carries the operator GSTIN teaches it to the profile, so a later month whose
  // export omits the column still fills Table 14. Only platforms with nothing saved are written:
  // a value the user typed is a deliberate correction and must not be overwritten by a file.
  const learned = new Map<string, string>();
  for (const row of mergeResult.mergedRows) {
    if (!row.ecoGstin || !row.sourcePlatformId) continue;
    if (fallbackEcoGstins.has(row.sourcePlatformId)) continue;
    if (!learned.has(row.sourcePlatformId)) learned.set(row.sourcePlatformId, row.ecoGstin);
  }
  if (learned.size > 0) {
    await prisma.ecoOperatorGstin.createMany({
      data: Array.from(learned, ([platformId, ecoGstin]) => ({
        userId: session.user.id,
        gstinNumber,
        platformId,
        ecoGstin,
        ecoName: getPlatformConfig(platformId).name,
      })),
      skipDuplicates: true,
    });
  }

  // 5. Net Sales Engine
  const netResult = processNetSales(mergeResult.mergedRows);

  // 6. Validation Engine
  const validationResult = validateInvoices(netResult.processedRows, gstinNumber);

  // 7. Statement Engine
  const statement: NetSalesStatement = generateStatement(
    netResult,
    validationResult.issues,
    validationResult.validCount,
    validationResult.errorCount,
    validationResult.reviewCount
  );

  // 8. Generate GSTR-1 JSON
  const gstr1Json = generateGstr1Json(validationResult.rows, gstinNumber, "", statement as never);
  const processingTimeMs = Date.now() - startTime;

  return {
    success: true as const,
    data: {
      rows: validationResult.rows,
      statement,
      gstr1Json,
      totalFilesProcessed: batches.length,
      processingTimeMs,
      /** Operator GSTINs learned from this upload, so the UI can say what it picked up. */
      detectedEcoGstins: Object.fromEntries(learned),
    },
  };
}

export async function applyAutoFixAction(rows: NormalizedInvoiceRow[], gstinNumber: string) {
  await requireSession();

  const { rows: fixedRows, summary: fixSummary } = applyAutoFixers(rows, gstinNumber);

  return {
    success: true as const,
    data: { ...revalidateRows(fixedRows, gstinNumber), fixSummary },
  };
}

/**
 * Applies every confidently-inferred GST rate at once.
 *
 * The suggestions are recomputed here rather than trusted from the payload: the browser can
 * edit anything it sends back, and a fabricated rate would flow straight into a filed return.
 */
export async function applySuggestedRatesAction(
  rows: NormalizedInvoiceRow[],
  gstinNumber: string,
  rowIds?: string[]
) {
  await requireSession();

  const target = rowIds ? new Set(rowIds) : null;
  const supplierState = gstinNumber ? gstinNumber.substring(0, 2) : "";
  let appliedCount = 0;

  const withRates = rows.map((row) => {
    if (target && !target.has(row.id)) return row;

    const suggestion = suggestGstRate(row, rows);
    if (!isConfidentSuggestion(suggestion)) return row;

    appliedCount += 1;
    return applyRateToRow(row, suggestion.rate, supplierState);
  });

  return {
    success: true as const,
    data: { ...revalidateRows(withRates, gstinNumber), appliedCount },
  };
}

/**
 * Re-runs the whole validation pipeline over the current rows without changing them.
 *
 * Rows carry errors from the last validation pass, so after a batch of manual edits the badges
 * can lag behind what the data now supports. This is the user's explicit "check it again".
 */
export async function revalidateAllAction(rows: NormalizedInvoiceRow[], gstinNumber: string) {
  await requireSession();

  const result = revalidateRows(rows, gstinNumber);
  return {
    success: true as const,
    data: { ...result, errorCount: result.statement.errorInvoices },
  };
}

/**
 * Saves a whole row edited in the review dialog.
 *
 * The inline editor could only ever change one cell, which is useless for a row that is wrong
 * in several places at once. Only the fields the dialog exposes are copied across — everything
 * else on the row, including its source metadata, is left as the pipeline produced it.
 */
export async function updateRowAction(
  rows: NormalizedInvoiceRow[],
  rowId: string,
  patch: EditableRowFields,
  gstinNumber: string
) {
  await requireSession();

  const supplierState = gstinNumber ? gstinNumber.substring(0, 2) : "";
  const nextRows = rows.map((row) => {
    if (row.id !== rowId) return row;

    const merged: NormalizedInvoiceRow = {
      ...row,
      invoiceNumber: patch.invoiceNumber,
      invoiceDate: patch.invoiceDate,
      buyerName: patch.buyerName,
      buyerGstin: patch.buyerGstin,
      placeOfSupply: patch.placeOfSupply,
      hsnCode: patch.hsnCode,
      quantity: patch.quantity,
      taxableValue: patch.taxableValue,
    };

    // A rate the user typed is authoritative, so the tax amounts are rederived from it rather
    // than kept from the upload — otherwise the correction just trades one mismatch for another.
    return applyRateToRow(merged, patch.gstRate, supplierState);
  });

  const result = revalidateRows(nextRows, gstinNumber);
  return {
    success: true as const,
    data: { ...result, rowErrors: result.rows.find((r) => r.id === rowId)?.errors ?? [] },
  };
}

export async function generateGstr1ExcelAction(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  period: string
) {
  const session = await requireSession();
  // Resolved server-side on every download — a watermark flag sent from the
  // browser could simply be flipped to false.
  const watermark = await shouldWatermark(session.user.id);
  const buffer = generateGstr1Excel(rows, gstin, period, watermark);
  return { success: true as const, data: { buffer: Array.from(buffer) } };
}

export async function generateCaReviewReportAction(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  period: string,
  statement?: NetSalesStatement
) {
  const session = await requireSession();
  const watermark = await shouldWatermark(session.user.id);
  const buffer = await generateCaReviewReport(rows, gstin, period, statement, watermark);
  return { success: true as const, data: { buffer: Array.from(buffer) } };
}

export async function saveConversionAction(input: {
  gstinNumber: string;
  returnPeriod: string;
  platformIds: string[];
  fileName: string;
  totalInvoices: number;
  totalTaxable: number;
  totalTax: number;
  jsonPayload: string;
  normalizedData: NormalizedInvoiceRow[];
  processingTimeMs?: number;
}) {
  const session = await requireSession();
  const platformIdLabel = input.platformIds.join(", ");

  const record = await prisma.conversionHistory.create({
    data: {
      userId: session.user.id,
      gstinNumber: input.gstinNumber,
      returnPeriod: input.returnPeriod,
      platformId: platformIdLabel,
      fileName: input.fileName,
      totalInvoices: input.totalInvoices,
      totalTaxable: input.totalTaxable,
      totalTax: input.totalTax,
      status: "COMPLETED",
      tcsStatus: "NOT_RECONCILED",
      processingTimeMs: input.processingTimeMs ?? 0,
      jsonPayload: JSON.parse(input.jsonPayload) as never,
      normalizedData: JSON.parse(JSON.stringify(input.normalizedData)) as never,
    },
  });

  return { success: true as const, data: { id: record.id } };
}
