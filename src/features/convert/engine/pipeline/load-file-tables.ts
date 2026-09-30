import { readWorkbook } from "@/features/convert/engine/universal/universal-import.engine";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";
import { extractTextFromPdfBuffer } from "@/features/pdf-extractor/engine/pdf-text-parser";
import { extractInvoiceFromText } from "@/features/pdf-extractor/engine/regex-invoice-extractor";

export interface LoadedTable {
  fileId: string;
  fileName: string;
  table: ReconstructedTable;
}

/**
 * The tables one uploaded file contributes to a conversion.
 *
 * Shared by the upload action and the corpus harness. The harness counted the
 * PDFs in a folder and never read them, so every seller who files their own
 * invoices as PDFs was measured against the CA with those invoices missing.
 *
 * A PDF is one invoice, laid out as the line-item table the rest of the
 * pipeline already knows. A workbook yields every sheet that holds rows.
 */
export async function loadFileTables(
  buffer: Buffer,
  fileName: string,
  gstinNumber?: string
): Promise<LoadedTable[]> {
  if (fileName.toLowerCase().endsWith(".pdf")) {
    const doc = await extractTextFromPdfBuffer(buffer);
    const inv = extractInvoiceFromText({
      text: doc.text,
      fileName,
      fileSizeBytes: buffer.length,
      pageCount: doc.pageCount,
      knownSupplierGstin: gstinNumber,
    });

    const rows: Record<string, string>[] = inv.lineItems.map((it) => ({
      "Invoice Number": inv.invoiceNumber,
      "Invoice Date": inv.invoiceDate,
      Type: inv.classification,
      "Document Type": inv.documentType,
      "Buyer Name": inv.buyerName,
      "Buyer GSTIN": inv.buyerGstin,
      "Place of Supply": inv.placeOfSupplyStateName,
      "HSN/SAC Code": it.hsnCode,
      "Item Description": it.itemDescription,
      UQC: it.uqc,
      Quantity: String(it.quantity),
      "GST Rate (%)": String(it.rate),
      "Taxable Value (Rs)": String(it.taxableValue),
      "IGST (Rs)": String(it.igstAmount),
      "CGST (Rs)": String(it.cgstAmount),
      "SGST (Rs)": String(it.sgstAmount),
      "Total Amount (Rs)": String(it.totalAmount),
      "File Name": fileName,
    }));

    if (rows.length === 0) return [];
    return [
      {
        fileId: fileName,
        fileName,
        table: {
          sheetName: "Invoice_Line_Items",
          headers: Object.keys(rows[0]!),
          rows,
          headerRowIndex: 0,
          headerRowSpan: 1,
          discarded: [],
          score: 100,
        },
      },
    ];
  }

  return readWorkbook(buffer, fileName, gstinNumber)
    .filter((table) => table.rows.length > 0)
    .map((table) => ({ fileId: fileName, fileName, table }));
}
