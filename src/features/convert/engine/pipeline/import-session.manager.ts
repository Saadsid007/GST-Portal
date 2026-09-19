import type { ReconstructedTable } from "@/features/convert/engine/universal/types";
import { PlatformDetector } from "@/features/convert/engine/detection/platform.detector";
import { classifyCompanionSheet } from "@/features/convert/engine/detection/companion-sheets";
import {
  isInvoiceDetailsSheet,
  parseInvoiceDetails,
  applyInvoiceDetails,
  type InvoiceDetailsIndex,
} from "@/features/convert/engine/enrichment/meesho-invoice-details";
import { AmazonAdapter } from "@/features/convert/engine/adapters/amazon.adapter";
import { MeeshoAdapter } from "@/features/convert/engine/adapters/meesho.adapter";
import { FlipkartAdapter } from "@/features/convert/engine/adapters/flipkart.adapter";
import { StockTransferAdapter } from "@/features/convert/engine/adapters/stock-transfer.adapter";
import { OfflineInvoicesAdapter } from "@/features/convert/engine/adapters/offline-invoices.adapter";
import type { AdapterResult } from "@/features/convert/engine/adapters/types";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

export interface SessionResult {
  sessionId: string;
  filesProcessed: number;
  resultsByPlatform: Record<string, AdapterResult>;
  combinedTransactions: NormalizedInvoiceRow[];
  unmappedFiles: ReconstructedTable[]; // Files that need Universal Engine / AI Mapping
  /**
   * Sheets deliberately not imported — summaries, instructions and amendment
   * tables that ship alongside the real data. Reported rather than dropped
   * silently, so the user can see the workbook was read in full.
   */
  skippedSheets: SkippedSheet[];
}

export interface SkippedSheet {
  fileName: string;
  sheetName: string;
  reason: string;
}

export class ImportSessionManager {
  /**
   * Processes a batch of tables, routing known platforms to deterministic adapters
   * and setting aside unknown files for the Universal Engine / AI Mapping.
   */
  static async processBatch(
    tables: { fileId: string; fileName: string; table: ReconstructedTable }[],
    supplierGstin?: string,
    fallbackEcoGstins?: Map<string, string>
  ): Promise<SessionResult> {
    const sessionId = crypto.randomUUID();
    const resultsByPlatform: Record<string, AdapterResult> = {};
    const unmappedFiles: ReconstructedTable[] = [];
    const skippedSheets: SkippedSheet[] = [];
    const combinedTransactions: NormalizedInvoiceRow[] = [];
    const invoiceDetails: InvoiceDetailsIndex = new Map();

    for (const { fileId, fileName, table } of tables) {
      // 0. Companion sheets never reach detection. An HSN roll-up or a document
      //    count has no line items, so sending it to the AI mapper only produces
      //    questions with no right answer.
      const companion = classifyCompanionSheet(table.sheetName, table.headers);
      if (companion) {
        skippedSheets.push({
          fileName,
          sheetName: table.sheetName,
          reason: companion.reason,
        });
        continue;
      }

      // 0b. Meesho's suborder→invoice index. Collected before detection
      //     because it holds no values of its own: it corrects the invoice
      //     numbers on rows that other sheets produce.
      if (isInvoiceDetailsSheet(table.headers)) {
        for (const [suborder, detail] of parseInvoiceDetails(table.rows)) {
          invoiceDetails.set(suborder, detail);
        }
        skippedSheets.push({
          fileName,
          sheetName: table.sheetName,
          reason: `Invoice number index — used to replace ${table.rows.length} order references with the invoice numbers you issued`,
        });
        continue;
      }

      // 1. Detect Platform
      const detection = PlatformDetector.detect(table.headers, table.sheetName, fileName);

      const sourceContext = {
        marketplace: detection.platformId.toUpperCase(),
        sourceId: `${detection.platformId}_${fileId}`,
        fileId,
        fileName,
        sheetName: table.sheetName,
        sourceRow: 0,
        reportType: detection.fileTypeId,
        supplierGstin,
        fallbackEcoGstin: fallbackEcoGstins?.get(detection.platformId),
      };

      // 2. Route to Adapter
      let result: AdapterResult | null = null;

      // Skip GSTR-1 reference files entirely — they are uploaded for the comparison
      // tab in Step 8, not as data sources. Processing them as MTR data would cause
      // double-counting and column-mapping errors.
      if (
        detection.fileTypeId === "amazon_gstr1_ref" ||
        detection.fileTypeId === "offline_summary_ref"
      ) {
        continue; // silently skip — summary/reference sheets
      }

      if (
        (detection.platformId === "amazon" || detection.platformId === "amazon_stock_transfer") &&
        detection.confidence > 50
      ) {
        if (detection.fileTypeId === "stock_transfer") {
          result = StockTransferAdapter.adapt(table.rows, sourceContext);
        } else {
          result = AmazonAdapter.adapt(table.rows, sourceContext);
        }
      } else if (detection.platformId === "meesho" && detection.confidence > 50) {
        result = MeeshoAdapter.adapt(table.rows, sourceContext);
      } else if (detection.platformId === "flipkart" && detection.confidence > 50) {
        result = FlipkartAdapter.adapt(table.rows, sourceContext);
      } else if (detection.platformId === "offline" && detection.confidence > 50) {
        result = OfflineInvoicesAdapter.adapt(table.rows, sourceContext);
      } else {
        // Platform is unknown or confidence is too low -> goes to Universal AI mapping
        unmappedFiles.push(table);
        continue;
      }

      // 3. Store Results
      if (result) {
        if (!resultsByPlatform[detection.platformId]) {
          // Initialize empty result for platform if doesn't exist
          resultsByPlatform[detection.platformId] = {
            sourceContext, // takes context of first file for summary
            transactions: [],
            unmappedColumns: [],
            totalRows: 0,
            validRows: 0,
            errorRows: 0,
          };
        }

        const agg = resultsByPlatform[detection.platformId];
        if (agg) {
          agg.transactions.push(...result.transactions);
          agg.totalRows += result.totalRows;
          agg.validRows += result.validRows;
          agg.errorRows += result.errorRows;
        }

        combinedTransactions.push(...result.transactions);
      }
    }

    // Applied once at the end: the index can arrive in any sheet of any
    // workbook, so the rows it corrects may already have been built.
    const enriched = applyInvoiceDetails(combinedTransactions, invoiceDetails);
    for (const platform of Object.values(resultsByPlatform)) {
      platform.transactions = applyInvoiceDetails(platform.transactions, invoiceDetails);
    }

    return {
      sessionId,
      filesProcessed: tables.length,
      resultsByPlatform,
      combinedTransactions: enriched,
      unmappedFiles,
      skippedSheets,
    };
  }
}
