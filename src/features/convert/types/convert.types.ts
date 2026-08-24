export type InvoiceCategory = "B2B" | "B2CL" | "B2CS" | "CDNR" | "CDNCS" | "EXP";
export type TransactionType = "Sales" | "Return" | "Adjustment";

export interface NormalizedInvoiceRow {
  id: string;
  rowIndex: number;
  sourcePlatformId?: string;
  sourcePlatformName?: string;
  sourceFileName?: string;
  sourceFileType?: string;
  transactionType?: TransactionType;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  invoiceType: InvoiceCategory;
  buyerName: string;
  buyerGstin: string;
  placeOfSupply: string; // 2-digit State Code e.g. "27"
  hsnCode: string;
  /** Product description carried into the HSN summary when the source file supplies one. */
  itemDescription?: string;
  /** GST unit quantity code, e.g. "PCS". Falls back to "OTH" when the source has no unit. */
  uqc?: string;
  quantity: number;
  taxableValue: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalValue: number;
  originalInvoiceNumber?: string;
  originalInvoiceDate?: string;
  /** GSTIN of the e-commerce operator that collected TCS. Drives GSTR-1 Table 14(a). */
  ecoGstin?: string;
  /** Legal name of that operator, kept for reports and debugging only. */
  ecoName?: string;

  /* ── Export (EXP) fields ───────────────────────────────────────────────
     Read by the GSTR-1 EXP sheet. Declared here because the generator was
     reaching for them through `as any`, which hid the fact that they exist
     nowhere in the model. No adapter populates them yet, so EXP rows still
     emit the WOPAY default and blank shipping-bill columns — mapping them
     from a marketplace export is a separate piece of work. */
  /** "WPAY" (with payment of tax) or "WOPAY". Defaults to WOPAY when absent. */
  exportType?: "WPAY" | "WOPAY";
  /** Six-character customs port code. */
  portCode?: string;
  shippingBillNumber?: string;
  /** YYYY-MM-DD. */
  shippingBillDate?: string;
  errors: string[];
  /**
   * Non-blocking findings. A row with reviews but no errors is recoverable — it still
   * counts as valid for filing once the suggestion is applied or accepted.
   */
  reviews?: string[];
  /** Present only while the row has no rate of its own and one could be inferred. */
  suggestedGstRate?: SuggestedGstRate;
}

export interface PlatformInfo {
  id: string;
  name: string;
  description: string;
  iconName: string;
  badge: string;
  accentColor: string;
}

export interface ValidationIssue {
  rowId: string;
  rowIndex: number;
  field: string;
  message: string;
  severity: "ERROR" | "REVIEW" | "WARNING";
}

/** A GST rate the pipeline inferred from the uploaded data, pending the user's confirmation. */
export interface SuggestedGstRate {
  rate: number;
  /** Agreement observed among matching rows in this upload, discounted for small samples. */
  confidence: number;
  sampleSize: number;
  source: "HSN" | "DESCRIPTION";
  reason: string;
}

/**
 * The fields the row editor lets a user correct.
 *
 * Deliberately narrower than the row itself: source metadata, ids and derived tax amounts are
 * the pipeline's to own, and letting the browser set them would let a bad payload rewrite
 * provenance. `gstRate` is the combined slab — the CGST/SGST/IGST split is derived server-side
 * from the place of supply.
 */
export interface EditableRowFields {
  invoiceNumber: string;
  invoiceDate: string;
  buyerName: string;
  buyerGstin: string;
  placeOfSupply: string;
  hsnCode: string;
  quantity: number;
  taxableValue: number;
  gstRate: number;
}

export interface PlatformContribution {
  platformId: string;
  platformName: string;
  totalInvoices: number;
  salesCount: number;
  returnCount: number;
  salesTaxable: number;
  salesTax: number;
  returnTaxable: number;
  returnTax: number;
  netTaxable: number;
  netTax: number;
}

export interface NetSalesStatement {
  totalInvoices: number;
  validInvoices: number;
  errorInvoices: number;
  /** Rows with an inferred rate awaiting one-click confirmation. Not counted as errors. */
  reviewInvoices: number;

  // Gross Sales
  totalSalesTaxable: number;
  totalSalesCgst: number;
  totalSalesSgst: number;
  totalSalesIgst: number;
  totalSalesCess: number;
  totalSalesTax: number;

  // Gross Returns
  totalReturnTaxable: number;
  totalReturnCgst: number;
  totalReturnSgst: number;
  totalReturnIgst: number;
  totalReturnCess: number;
  totalReturnTax: number;

  // Net Sales
  netTaxable: number;
  netCgst: number;
  netSgst: number;
  netIgst: number;
  netCess: number;
  netTax: number;
  netGrandTotal: number;

  // Category counts & totals
  b2bCount: number;
  b2clCount: number;
  b2csCount: number;
  cdnrCount: number;
  expCount: number;

  b2bNetTaxable: number;
  b2clNetTaxable: number;
  b2csNetTaxable: number;
  cdnrNetTaxable: number;
  expNetTaxable: number;

  platformContributions: PlatformContribution[];
  issues: ValidationIssue[];
}

export type ConversionSummary = NetSalesStatement;

export interface MultiUploadFileInput {
  platformId: string;
  fileTypeId: string;
  fileName: string;
  /**
   * The raw file. Passed as a Blob rather than an encoded string: React's Server
   * Action serializer counts string lengths toward its array-size limit, so a
   * base64 payload of several hundred KB inside an array is rejected outright.
   */
  file: File;
}
