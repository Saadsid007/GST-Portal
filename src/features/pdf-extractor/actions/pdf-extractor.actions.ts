"use server";

import { requireSession } from "@/features/auth";
import { extractTextFromPdfBuffer } from "../engine/pdf-text-parser";
import { extractInvoiceFromText } from "../engine/regex-invoice-extractor";
import {
  formatGstr1BatchResult,
  generatePdfInvoicesExcel,
} from "../engine/gstr1-formatter";
import type { ExtractedInvoice, PdfExtractionBatchResult } from "../domain/types";

export interface ExtractPdfActionResponse {
  success: boolean;
  data?: PdfExtractionBatchResult;
  error?: string;
}

export async function extractPdfInvoicesAction(formData: FormData): Promise<ExtractPdfActionResponse> {
  try {
    await requireSession();

    const supplierGstin = (formData.get("supplierGstin") as string) || "";
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return { success: false, error: "No PDF files were provided for extraction." };
    }

    const extractedInvoices: ExtractedInvoice[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const parsedDoc = await extractTextFromPdfBuffer(buffer);

      const invoice = extractInvoiceFromText({
        text: parsedDoc.text,
        fileName: file.name,
        fileSizeBytes: file.size,
        pageCount: parsedDoc.pageCount,
        knownSupplierGstin: supplierGstin,
      });

      extractedInvoices.push(invoice);
    }

    if (extractedInvoices.length === 0) {
      return { success: false, error: "Could not extract valid text from the uploaded PDF files." };
    }

    const batchResult = formatGstr1BatchResult(extractedInvoices);

    return {
      success: true,
      data: batchResult,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to extract PDF invoices.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

export async function downloadExtractedExcelAction(invoices: ExtractedInvoice[]): Promise<{
  success: boolean;
  base64?: string;
  fileName?: string;
  error?: string;
}> {
  try {
    await requireSession();
    if (!invoices || invoices.length === 0) {
      return { success: false, error: "No invoices provided for export." };
    }

    const excelBytes = generatePdfInvoicesExcel(invoices);
    const base64 = Buffer.from(excelBytes).toString("base64");
    const fileName = `GST_Extracted_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return {
      success: true,
      base64,
      fileName,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate Excel export.",
    };
  }
}
