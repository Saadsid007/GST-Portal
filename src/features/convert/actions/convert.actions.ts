"use server";

import { requireSession } from "@/features/auth";
import { shouldWatermark } from "@/features/billing/services/entitlement.service";
import {
  readWorkbook,
  solveTable,
  toCanonicalRows,
} from "@/features/convert/engine/universal/universal-import.engine";
import { recoverRows } from "@/features/convert/engine/universal/recovery";
import {
  classifyDuplicates,
  redundantRowIndexes,
} from "@/features/convert/engine/universal/duplicates";
import type {
  ImportIntelligenceReport,
  QuestionAnswer,
  ReconstructedTable,
} from "@/features/convert/engine/universal/types";
import { evaluateDualAiMapping } from "@/features/convert/engine/ai/dual-engine.service";
import { ImportSessionManager } from "@/features/convert/engine/pipeline/import-session.manager";
import { transformMappedRows } from "@/features/convert/engine/transformation/transformation.engine";
import { RuleEngine } from "@/features/convert/engine/rules/rule.engine";
import { mergeTransactions, type ParsedFileBatch } from "@/features/convert/engine/merge.engine";
import { processNetSales } from "@/features/convert/engine/net-sales.engine";
import { validateInvoices } from "@/features/convert/domain/validator";
import { generateStatement } from "@/features/convert/engine/statement.engine";
import { generateGstr1Json } from "@/features/convert/domain/gstr1-json.generator";
import { generateGstr1Excel } from "@/features/convert/domain/gstr1-excel.generator";
import { generateCaReviewReport } from "@/features/convert/domain/ca-review-report.generator";
import { parseGstr1File } from "@/features/convert/engine/comparison/gstr1-template.parser";
import {
  Gstr1Comparator,
  type Gstr1ComparisonResult,
} from "@/features/convert/engine/comparison/gstr1.comparator";
import * as XLSX from "xlsx";
import { getPlatformConfig } from "@/features/convert/config/platform.config";
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
import type { ColumnMappingDict } from "@/features/convert/engine/universal/canonical-fields";

import { extractTextFromPdfBuffer } from "@/features/pdf-extractor/engine/pdf-text-parser";
import { extractInvoiceFromText } from "@/features/pdf-extractor/engine/regex-invoice-extractor";

export interface FileCustomMapping {
  platformId: string;
  fileTypeId: string;
  mapping: ColumnMappingDict;
}

async function loadFileTables(
  fileItem: MultiUploadFileInput,
  gstinNumber?: string
): Promise<{ fileId: string; fileName: string; table: ReconstructedTable }[]> {
  const isPdf = fileItem.fileName.toLowerCase().endsWith(".pdf");
  const buffer = Buffer.from(await fileItem.file.arrayBuffer());

  if (isPdf) {
    const doc = await extractTextFromPdfBuffer(buffer);
    const inv = extractInvoiceFromText({
      text: doc.text,
      fileName: fileItem.fileName,
      fileSizeBytes: buffer.length,
      pageCount: doc.pageCount,
      knownSupplierGstin: gstinNumber,
    });

    const rows: Record<string, string>[] = inv.lineItems.map((it) => ({
      "Invoice Number": inv.invoiceNumber,
      "Invoice Date": inv.invoiceDate,
      "Type": inv.classification,
      "Buyer Name": inv.buyerName,
      "Buyer GSTIN": inv.buyerGstin,
      "Place of Supply": inv.placeOfSupplyStateName,
      "HSN/SAC Code": it.hsnCode,
      "Item Description": it.itemDescription,
      "UQC": it.uqc,
      "Quantity": String(it.quantity),
      "GST Rate (%)": String(it.rate),
      "Taxable Value (Rs)": String(it.taxableValue),
      "IGST (Rs)": String(it.igstAmount),
      "CGST (Rs)": String(it.cgstAmount),
      "SGST (Rs)": String(it.sgstAmount),
      "Total Amount (Rs)": String(it.totalAmount),
      "File Name": fileItem.fileName,
    }));

    return [
      {
        fileId: fileItem.fileName,
        fileName: fileItem.fileName,
        table: {
          sheetName: "Invoice_Line_Items",
          headers: Object.keys(rows[0] || {}),
          rows,
          headerRowIndex: 0,
          headerRowSpan: 1,
          discarded: [],
          score: 100,
        },
      },
    ];
  }

  const tables = readWorkbook(buffer);
  const result: { fileId: string; fileName: string; table: ReconstructedTable }[] = [];
  for (const table of tables) {
    if (table && table.rows.length > 0) {
      result.push({ fileId: fileItem.fileName, fileName: fileItem.fileName, table });
    }
  }
  return result;
}

/**
 * Runs just the semantic understanding and field discovery passes,
 * returning the intelligence report (and questions) before processing begins.
 */
export async function evaluateWorkbooksAction(files: MultiUploadFileInput[], gstinNumber?: string) {
  await requireSession();
  const reports: ImportIntelligenceReport[] = [];

  const rawTables: { fileId: string; fileName: string; table: ReconstructedTable }[] = [];
  for (const fileItem of files) {
    const loaded = await loadFileTables(fileItem, gstinNumber);
    rawTables.push(...loaded);
  }

  const sessionResult = await ImportSessionManager.processBatch(rawTables, gstinNumber);

  // For unmapped files (Unknown Platforms), run Dual-AI and solve universally
  for (const table of sessionResult.unmappedFiles) {
    const fileItem = files.find(
      (f) =>
        f.fileName === table.sheetName ||
        rawTables.find((r) => r.table === table)?.fileName === f.fileName
    );
    const fileName = fileItem ? fileItem.fileName : "Unknown File";
    const aiResult = await evaluateDualAiMapping(table.headers, table.rows);

    if (aiResult) {
      const solved = solveTable(table, {
        fileName,
        overrides: aiResult.mapping,
      });
      solved.report.aiResult = {
        activeModels: aiResult.activeModels,
        synthesisUsed: aiResult.synthesisUsed,
        headerToKeyMap: aiResult.headerToKeyMap,
        explanations: aiResult.explanations,
      };
      reports.push(solved.report);
    } else {
      const solved = solveTable(table, {
        fileName,
      });
      reports.push(solved.report);
    }
  }

  // We can also inject adapter reports into `reports` if we want to show them in UI,
  // but for now UI expects Universal Reports. The prompt asked to bypass AI for known platforms.
  // We'll return sessionResult alongside reports.

  return { success: true as const, data: { reports, sessionResult } };
}

/**
 * Multi-Platform File Parser Action:
 * Executes the complete 10-stage pipeline with timing metrics.
 */
export async function parseMultiPlatformFilesAction(
  files: MultiUploadFileInput[],
  gstinNumber: string,
  answersByFile?: Record<string, QuestionAnswer[]>
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
  const reports: ImportIntelligenceReport[] = [];
  const supplierStateCode = gstinNumber.slice(0, 2);

  const rawTables: { fileId: string; fileName: string; table: ReconstructedTable }[] = [];
  for (const fileItem of files) {
    const loaded = await loadFileTables(fileItem, gstinNumber);
    rawTables.push(...loaded);
  }

  const sessionResult = await ImportSessionManager.processBatch(
    rawTables,
    gstinNumber,
    fallbackEcoGstins
  );

  // Add adapter results as batches
  for (const [platformId, result] of Object.entries(sessionResult.resultsByPlatform)) {
    const platformConfig = getPlatformConfig(platformId);
    batches.push({
      platformId: platformId,
      platformName: platformConfig.name,
      fileName: result.sourceContext.fileName,
      fileTypeId: result.sourceContext.reportType,
      rows: result.transactions,
    });
  }

  // Process unknown files through universal engine
  for (const table of sessionResult.unmappedFiles) {
    const fileItem = files.find(
      (f) => rawTables.find((r) => r.table === table)?.fileName === f.fileName
    );
    if (!fileItem) continue;

    const platformConfig = getPlatformConfig(fileItem.platformId);
    const fileAnswers = answersByFile?.[fileItem.fileName] ?? [];

    const solved = solveTable(table, {
      fileName: fileItem.fileName,
      answers: fileAnswers,
    });

    const canonicalRows = toCanonicalRows(table, solved.mapping);
    const transformedRows = transformMappedRows(canonicalRows, {
      platformId: fileItem.platformId,
      platformName: platformConfig.name,
      fileName: fileItem.fileName,
      fileTypeId: fileItem.fileTypeId,
      supplierGstin: gstinNumber,
      fallbackEcoGstin: fallbackEcoGstins.get(fileItem.platformId),
    });

    batches.push({
      platformId: fileItem.platformId,
      platformName: platformConfig.name,
      fileName: fileItem.fileName,
      fileTypeId: fileItem.fileTypeId,
      rows: transformedRows,
    });

    reports.push(solved.report);
  }

  // Flatten for recovery pass
  const allTransformedRows = batches.flatMap((b) => b.rows);

  const { rows: recoveredRows } = recoverRows(
    allTransformedRows,
    reports[0]?.understanding || {
      documentType: "MIXED",
      documentTypeConfidence: 100,
      documentEvidence: [],
      marketplaceHint: null,
      period: null,
      periodConfidence: 0,
      b2bShare: 0,
      supplyMix: "MIXED",
      rowCount: allTransformedRows.length,
      columnCount: 10,
    },
    supplierStateCode
  );

  // Update batches with recovered rows, deduplicate, and apply rules
  let offset = 0;
  for (const batch of batches) {
    batch.rows = recoveredRows.slice(offset, offset + batch.rows.length);
    offset += batch.rows.length;

    // Duplicate Checks within the source batch
    const duplicates = classifyDuplicates(batch.rows);
    const redundant = redundantRowIndexes(duplicates);
    const deduped = batch.rows.filter((_, index) => !redundant.has(index));

    // Rule Engine
    batch.rows = RuleEngine.applyRowRules(deduped, batch.platformId);
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

  // 9. Auto-run GSTR-1 comparison if a reference GSTR-1 file was uploaded in step 5
  let gstr1CmpResult: Gstr1ComparisonResult | null = null;
  let gstr1CmpLabel: string | undefined = undefined;

  const refFileItem = files.find((f) => {
    const fn = f.fileName.toLowerCase();
    return (
      fn.startsWith("gstr1") ||
      fn.includes("gstr1_excel_workbook") ||
      f.fileTypeId === "amazon_gstr1_ref"
    );
  });

  if (refFileItem) {
    try {
      const buffer = Buffer.from(await refFileItem.file.arrayBuffer());
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parsedRef = parseGstr1File(wb);
      gstr1CmpResult = Gstr1Comparator.compare(validationResult.rows, parsedRef);
      gstr1CmpLabel = refFileItem.fileName;
    } catch {
      // Silent fallback
    }
  }

  return {
    success: true as const,
    data: {
      rows: validationResult.rows,
      statement,
      gstr1Json,
      totalFilesProcessed: batches.length,
      processingTimeMs,
      /**
       * How each workbook was understood, mapped and recovered. Surfaced so the
       * user can see why the engine trusted the file rather than taking the
       * output on faith.
       */
      importReports: reports,
      /** Operator GSTINs learned from this upload, so the UI can say what it picked up. */
      detectedEcoGstins: Object.fromEntries(learned),
      gstr1CmpResult,
      gstr1CmpLabel,
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
