import { PDFParse } from "pdf-parse";

export interface ParsedPdfDocument {
  text: string;
  pageCount: number;
  info?: Record<string, unknown>;
}

export async function extractTextFromPdfBuffer(buffer: Buffer | Uint8Array): Promise<ParsedPdfDocument> {
  const uint8 = new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const parser = new PDFParse(uint8);
  const result = await parser.getText();

  // Normalize excessive spaces and irregular line breaks
  const cleanText = (result.text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \t]{2,}/g, " ");

  return {
    text: cleanText,
    pageCount: result.pages?.length || 1,
  };
}
