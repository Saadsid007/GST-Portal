import { readWorkbook } from "@/features/convert/engine/universal/universal-import.engine";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";
import { extractTextFromPdfBuffer } from "@/features/pdf-extractor/engine/pdf-text-parser";
import { extractInvoiceFromText } from "@/features/pdf-extractor/engine/regex-invoice-extractor";
import { ownGstinRole } from "@/features/pdf-extractor/domain/party-role";

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

    // A seller names a void invoice's file for what it is — "INV2608
    // CANCELLED.pdf" — and the accountant leaves it out of every table. It is
    // still a number the seller issued, so Table 13 counts it as cancelled.
    const cancelled = /\bcancel{1,2}ed\b/i.test(fileName);

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
      Status: cancelled ? "Cancelled" : "",
    }));

    if (rows.length === 0) return [];

    // Either reading is enough: the labels around the seller's GSTIN, or the
    // extractor having found that GSTIN in the buyer's block.
    const own = gstinNumber?.trim().toUpperCase() ?? "";
    const received =
      own.length === 15 &&
      (inv.buyerGstin.toUpperCase() === own || ownGstinRole(doc.text, own) === "recipient");
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
          ...(received && {
            skipReason:
              "A bill you received — your GSTIN is on it as the buyer. GSTR-1 reports only your sales, so it is left out.",
          }),
        },
      },
    ];
  }

  return readWorkbook(buffer, fileName, gstinNumber)
    .filter((table) => table.rows.length > 0)
    .map((table) => ({ fileId: fileName, fileName, table }));
}
