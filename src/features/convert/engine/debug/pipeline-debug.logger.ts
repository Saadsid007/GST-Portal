import type {
  FieldDetectionMethod,
  PipelineDebugReport,
  PipelineDebugTraceItem,
} from "@/features/convert/engine/mapping/types";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Pipeline Debug Logger:
 * Generates an inspectable audit trace for every upload showing:
 * Original Header -> Mapped Field -> Layer Method -> Confidence -> Sample Value -> Transformed Value -> Validation Result -> Target GSTR-1 Section
 */
export class PipelineDebugLogger {
  static createReport(
    fileName: string,
    platformId: string,
    parserVersion: string,
    headerSignature: string,
    headers: string[],
    fieldConfidences: {
      mappedHeader: string | null;
      targetField: string;
      detectionMethod: FieldDetectionMethod;
      confidence: number;
    }[],
    sampleRawRow: Record<string, unknown>,
    transformedSampleRow?: NormalizedInvoiceRow
  ): PipelineDebugReport {
    const traces: PipelineDebugTraceItem[] = [];

    for (const header of headers) {
      const conf = fieldConfidences.find((c) => c.mappedHeader === header);
      const canonicalKey = conf?.targetField ?? null;
      const rawVal = String(sampleRawRow[header] ?? "");

      let transformedVal: unknown = rawVal;
      let valResult: "PASS" | "FAIL" | "WARNING" = "PASS";
      let section = "Unmapped";

      if (canonicalKey && transformedSampleRow) {
        transformedVal = (transformedSampleRow as unknown as Record<string, unknown>)[canonicalKey];
        if (transformedSampleRow.errors && transformedSampleRow.errors.length > 0) {
          valResult = "WARNING";
        }
        section = transformedSampleRow.invoiceType || "B2CS (Table 7)";
      }

      traces.push({
        originalHeader: header,
        mappedCanonicalKey: canonicalKey,
        layerMethod: conf?.detectionMethod ?? "UNMAPPED",
        confidence: conf?.confidence ?? 0,
        sampleRawValue: rawVal,
        transformedValue: transformedVal,
        validationResult: valResult,
        gstr1TargetSection: section,
      });
    }

    return {
      fileName,
      platformId,
      parserVersion,
      headerSignature,
      traces,
      timestamp: new Date().toISOString(),
    };
  }
}
