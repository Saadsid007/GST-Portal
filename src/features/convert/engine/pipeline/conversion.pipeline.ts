import { ImportSessionManager } from "@/features/convert/engine/pipeline/import-session.manager";
import { getPlatformConfig } from "@/features/convert/config/platform.config";
import {
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
import { transformMappedRows } from "@/features/convert/engine/transformation/transformation.engine";
import { RuleEngine } from "@/features/convert/engine/rules/rule.engine";
import { mergeTransactions, type ParsedFileBatch } from "@/features/convert/engine/merge.engine";
import { processNetSales } from "@/features/convert/engine/net-sales.engine";
import { validateInvoices } from "@/features/convert/domain/validator";
import { generateStatement } from "@/features/convert/engine/statement.engine";
import { generateGstr1Json } from "@/features/convert/domain/gstr1-json.generator";
import type { NetSalesStatement } from "@/features/convert/types/convert.types";

/**
 * The conversion, from tables read off the uploaded files to a GSTR-1.
 *
 * One function, called by the server action and by the corpus harness alike.
 * The harness used to rebuild the pipeline for itself and skip half of it:
 * it read the combined rows where the product reads them platform by
 * platform, and never ran the merge or the net sales stage. So a fix the
 * harness confirmed — returns an accountant typed under a sales export,
 * counted once — was never live in the product, and every such return was
 * counted twice. A check that does not take the product's path is not a check
 * of the product.
 *
 * Nothing here touches the database or the session. The caller supplies what
 * those would have provided.
 */

export interface PipelineFile {
  fileName: string;
  /** The marketplace the user uploaded the file under. */
  platformId: string;
  fileTypeId: string;
}

export interface ConversionPipelineInput {
  rawTables: { fileId: string; fileName: string; table: ReconstructedTable }[];
  files: PipelineFile[];
  gstinNumber: string;
  /** The period the user is filing for; the portal checks the file against it. */
  returnPeriod: string;
  /** Operator GSTINs the user has saved, by platform. */
  fallbackEcoGstins?: Map<string, string>;
  answersByFile?: Record<string, QuestionAnswer[]>;
}

export async function runConversionPipeline(input: ConversionPipelineInput) {
  const { rawTables, files, gstinNumber, returnPeriod, answersByFile } = input;
  const fallbackEcoGstins = input.fallbackEcoGstins ?? new Map<string, string>();

  const batches: ParsedFileBatch[] = [];
  const reports: ImportIntelligenceReport[] = [];
  const supplierStateCode = gstinNumber.slice(0, 2);

  const sessionResult = await ImportSessionManager.processBatch(
    rawTables,
    gstinNumber,
    fallbackEcoGstins
  );

  for (const [platformId, result] of Object.entries(sessionResult.resultsByPlatform)) {
    batches.push({
      platformId,
      platformName: getPlatformConfig(platformId).name,
      fileName: result.sourceContext.fileName,
      fileTypeId: result.sourceContext.reportType,
      rows: result.transactions,
    });
  }

  // Files no adapter recognised go through the universal engine, under the
  // marketplace the user uploaded them as.
  for (const table of sessionResult.unmappedFiles) {
    const fileName = rawTables.find((r) => r.table === table)?.fileName;
    const fileItem = files.find((f) => f.fileName === fileName);
    if (!fileItem) continue;

    const platformConfig = getPlatformConfig(fileItem.platformId);
    const solved = solveTable(table, {
      fileName: fileItem.fileName,
      answers: answersByFile?.[fileItem.fileName] ?? [],
    });

    batches.push({
      platformId: fileItem.platformId,
      platformName: platformConfig.name,
      fileName: fileItem.fileName,
      fileTypeId: fileItem.fileTypeId,
      rows: transformMappedRows(toCanonicalRows(table, solved.mapping), {
        platformId: fileItem.platformId,
        platformName: platformConfig.name,
        fileName: fileItem.fileName,
        fileTypeId: fileItem.fileTypeId,
        supplierGstin: gstinNumber,
        fallbackEcoGstin: fallbackEcoGstins.get(fileItem.platformId),
      }),
    });
    reports.push(solved.report);
  }

  if (batches.length === 0) return null;

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

  let offset = 0;
  for (const batch of batches) {
    batch.rows = recoveredRows.slice(offset, offset + batch.rows.length);
    offset += batch.rows.length;

    const redundant = redundantRowIndexes(classifyDuplicates(batch.rows));
    batch.rows = RuleEngine.applyRowRules(
      batch.rows.filter((_, index) => !redundant.has(index)),
      batch.platformId
    );
  }

  const mergeResult = mergeTransactions(batches);
  const netResult = processNetSales(mergeResult.mergedRows);
  const validationResult = validateInvoices(netResult.processedRows, gstinNumber);
  const statement: NetSalesStatement = generateStatement(
    netResult,
    validationResult.issues,
    validationResult.validCount,
    validationResult.errorCount,
    validationResult.reviewCount
  );
  const gstr1Json = generateGstr1Json(
    validationResult.rows,
    gstinNumber,
    returnPeriod,
    statement as never
  );

  return {
    sessionResult,
    reports,
    batches,
    mergeResult,
    rows: validationResult.rows,
    statement,
    gstr1Json,
  };
}
