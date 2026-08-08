import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

export interface SourceContext {
  marketplace: string; // e.g. "AMAZON", "MEESHO", "FLIPKART", "UNKNOWN"
  sourceId: string; // e.g. "amazon_01"
  fileId: string; // specific file from which this row came
  fileName: string;
  sheetName: string;
  sourceRow: number;
  reportType: string; // e.g. "MTR_B2B", "GST_REPORT"
}

export interface AdapterResult {
  sourceContext: SourceContext;
  transactions: NormalizedInvoiceRow[];
  unmappedColumns: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}
