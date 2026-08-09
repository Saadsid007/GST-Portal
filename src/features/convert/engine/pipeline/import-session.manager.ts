import type { ReconstructedTable } from "@/features/convert/engine/universal/types";
import { PlatformDetector } from "@/features/convert/engine/detection/platform.detector";
import { AmazonAdapter } from "@/features/convert/engine/adapters/amazon.adapter";
import { MeeshoAdapter } from "@/features/convert/engine/adapters/meesho.adapter";
import { FlipkartAdapter } from "@/features/convert/engine/adapters/flipkart.adapter";
import { StockTransferAdapter } from "@/features/convert/engine/adapters/stock-transfer.adapter";
import type { AdapterResult } from "@/features/convert/engine/adapters/types";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

export interface SessionResult {
  sessionId: string;
  filesProcessed: number;
  resultsByPlatform: Record<string, AdapterResult>;
  combinedTransactions: NormalizedInvoiceRow[];
  unmappedFiles: ReconstructedTable[]; // Files that need Universal Engine / AI Mapping
}

export class ImportSessionManager {
  /**
   * Processes a batch of tables, routing known platforms to deterministic adapters
   * and setting aside unknown files for the Universal Engine / AI Mapping.
   */
  static async processBatch(
    tables: { fileId: string; fileName: string; table: ReconstructedTable }[]
  ): Promise<SessionResult> {
    const sessionId = crypto.randomUUID();
    const resultsByPlatform: Record<string, AdapterResult> = {};
    const unmappedFiles: ReconstructedTable[] = [];
    const combinedTransactions: NormalizedInvoiceRow[] = [];

    for (const { fileId, fileName, table } of tables) {
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
      };

      // 2. Route to Adapter
      let result: AdapterResult | null = null;

      if (detection.platformId === "amazon" && detection.confidence > 50) {
        result = AmazonAdapter.adapt(table.rows, sourceContext);
      } else if (detection.platformId === "amazon_stock_transfer" && detection.confidence > 50) {
        result = StockTransferAdapter.adapt(table.rows, sourceContext);
      } else if (detection.platformId === "meesho" && detection.confidence > 50) {
        result = MeeshoAdapter.adapt(table.rows, sourceContext);
      } else if (detection.platformId === "flipkart" && detection.confidence > 50) {
        result = FlipkartAdapter.adapt(table.rows, sourceContext);
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

    return {
      sessionId,
      filesProcessed: tables.length,
      resultsByPlatform,
      combinedTransactions,
      unmappedFiles,
    };
  }
}
