export type InvoiceClassification = "B2B" | "B2CL" | "B2CS" | "CDNR" | "CDNUR" | "EXP" | "OTHER";

export interface ExtractedLineItem {
  itemDescription: string;
  hsnCode: string;
  uqc: string;
  quantity: number;
  rate: number;
  taxableValue: number;
  igstRate: number;
  cgstRate: number;
  sgstRate: number;
  cessRate: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  totalAmount: number;
}

export interface FlatLineItemRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  classification: InvoiceClassification;
  buyerName: string;
  buyerGstin: string;
  placeOfSupply: string;
  hsnCode: string;
  itemDescription: string;
  uqc: string;
  quantity: number;
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  totalAmount: number;
  fileName: string;
}

export interface ExtractedInvoice {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;

  // Header Details
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD or DD-MM-YYYY
  classification: InvoiceClassification;
  documentType: "Invoice" | "Credit Note" | "Debit Note" | "Bill of Supply";

  // Supplier & Buyer
  supplierName: string;
  supplierGstin: string;
  buyerName: string;
  buyerGstin: string;
  placeOfSupply: string; // 2-digit state code or state name
  placeOfSupplyStateName: string;
  reverseCharge: boolean;
  ecommerceGstin?: string;

  // Financials
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  totalTaxAmount: number;
  totalInvoiceValue: number;
  gstRate: number;

  // Line items & Raw
  lineItems: ExtractedLineItem[];
  rawText: string;
  confidenceScore: number; // 0 to 100
  notes: string[];
}

export interface ExtractedHsnRow {
  hsnCode: string;
  description: string;
  uqc: string;
  totalQuantity: number;
  totalValue: number;
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

export interface ExtractedB2csRow {
  type: string; // "OE" = E-Commerce, "OS" = Other Than E-Commerce
  placeOfSupply: string; // e.g. "09-Uttar Pradesh"
  applicablePercentage: string; // ""
  rate: number;
  taxableValue: number;
  cessAmount: number;
  ecommerceGstin: string;
}

export interface PdfExtractionBatchResult {
  invoices: ExtractedInvoice[];
  allLineItems: FlatLineItemRow[];
  hsnSummary: ExtractedHsnRow[];
  b2bHsnSummary: ExtractedHsnRow[];
  b2csSummary: ExtractedB2csRow[];
  totalInvoicesCount: number;
  totalLineItemsCount: number;
  b2bCount: number;
  b2cCount: number;
  totalTaxableValue: number;
  totalIgstAmount: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalCessAmount: number;
  totalGrossAmount: number;
  formattedGstr1LineItemsTsv: string;
  formattedGstr1B2bTsv: string;
  formattedGstr1B2csTsv: string;
  formattedGstr1HsnTsv: string;
  formattedGstr1B2bHsnTsv: string;
  formattedGstr1DocsTsv: string;
}
