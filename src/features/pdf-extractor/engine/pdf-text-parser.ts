import { extractText, getDocumentProxy } from "unpdf";

export interface ParsedPdfDocument {
  text: string;
  pageCount: number;
  info?: Record<string, unknown>;
}

export async function extractTextFromPdfBuffer(buffer: Buffer | Uint8Array): Promise<ParsedPdfDocument> {
  // Convert Node.js Buffer to a pure standard Uint8Array to satisfy unpdf checks
  const uint8 = new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const pdf = await getDocumentProxy(uint8);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });

  // Normalize excessive spaces and irregular line breaks
  const cleanText = (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \t]{2,}/g, " ");

  return {
    text: cleanText,
    pageCount: totalPages || 1,
  };
}
