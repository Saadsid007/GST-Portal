"use server";

import { requireSession } from "@/features/auth";
import { extractTextFromPdfBuffer } from "@/features/pdf-extractor/engine/pdf-text-parser";
import { extractInvoiceFromText } from "@/features/pdf-extractor/engine/regex-invoice-extractor";
import { readInvoiceSheet } from "@/features/convert/engine/universal/excel-invoice-document";
import { readWorkbookSafely } from "@/features/convert/utils/workbook.utils";
import {
  formatGstr1BatchResult,
  generatePdfInvoicesExcel,
} from "@/features/pdf-extractor/engine/gstr1-formatter";
import type {
  ExtractedInvoice,
  PdfExtractionBatchResult,
} from "@/features/pdf-extractor/domain/types";

export interface ExtractPdfActionResponse {
  success: boolean;
  data?: PdfExtractionBatchResult;
  error?: string;
}

export async function extractPdfInvoicesAction(
  formData: FormData
): Promise<ExtractPdfActionResponse> {
  try {
    await requireSession();

    const supplierGstin = (formData.get("supplierGstin") as string) || "";
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return { success: false, error: "No PDF files were provided for extraction." };
    }

    const extractedInvoices: ExtractedInvoice[] = [];

    for (const file of files) {
      const name = file.name.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      // A small seller bills from a spreadsheet template and hands over one
      // file per invoice. That is the same document as a PDF invoice, read
      // from a grid rather than from a line of text, so it belongs here
      // alongside them rather than in a tool of its own.
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const { workbook } = readWorkbookSafely(buffer, {
          raw: false,
          cellDates: false,
          codepage: 65001,
        });
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;
          const invoice = readInvoiceSheet(worksheet, file.name, supplierGstin);
          if (invoice) extractedInvoices.push({ ...invoice, fileSizeBytes: file.size });
        }
        continue;
      }

      if (!name.endsWith(".pdf")) continue;

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
      return {
        success: false,
        error:
          "No invoice could be read from these files. A PDF needs a text layer rather than a scan, and a spreadsheet needs to be one printed invoice — a register of many belongs in the converter instead.",
      };
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
