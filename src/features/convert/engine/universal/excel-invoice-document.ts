import * as XLSX from "xlsx";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";
import { transformDate } from "@/features/convert/engine/transformation/transformers";
import { stateFromPinCode, STATE_CODES } from "@/features/convert/domain/state-codes";

/**
 * A single invoice printed into a spreadsheet.
 *
 * Small sellers bill from an Excel template and hand over one file per
 * invoice. The sheet is a document, not a table: the number, the date and the
 * buyer sit in a heading block above a short list of goods, and no goods row
 * carries any of them. Read as a table it yields six columns of line items
 * with no invoice number anywhere, which is why these files reached the AI
 * mapper and came back unmapped — a seller whose register was not also in the
 * folder lost every one of them.
 *
 * It cannot be read the way an invoice PDF is. In a PDF a label and its value
 * sit next to each other in the text; in a spreadsheet the label is in one
 * row and the value two rows below in the same column, and flattening the
 * sheet to text puts them on separate lines where no pattern reaches across.
 * So the grid is read as a grid: find the labelled cell, then look where the
 * person filling the template would have typed.
 */

/** How far below a label its value may sit before the two are unrelated. */
const VALUE_SEARCH_DEPTH = 3;

const GSTIN = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/g;
const DOCUMENT_HEADING = /\b(tax\s*invoice|bill\s*of\s*supply|delivery\s*challan|proforma)\b/i;
const REGISTER_COLUMN = /\b(invoice|document|bill)\s*(number|no\.?|date|id)\b/i;

export type Grid = string[][];

/** The sheet's cells with their positions intact, blank rows included. */
export function sheetGrid(worksheet: XLSX.WorkSheet): Grid {
  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: true,
    defval: "",
  }) as unknown[][];
  return aoa.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

/**
 * Whether the sheet is one printed invoice rather than a list of many.
 *
 * Both halves matter. The heading alone would catch a register titled "Tax
 * Invoice Register", and the absent column alone would catch any sheet whose
 * headers we simply failed to read.
 */
export function looksLikeInvoiceDocument(grid: Grid, headers: string[]): boolean {
  const heading = grid
    .slice(0, 12)
    .flat()
    .some((cell) => DOCUMENT_HEADING.test(cell));
  if (!heading) return false;

  return !headers.some((header) => REGISTER_COLUMN.test(header));
}

function findLabel(grid: Grid, label: RegExp): { row: number; col: number } | null {
  for (let row = 0; row < grid.length; row++) {
    const cells = grid[row] ?? [];
    for (let col = 0; col < cells.length; col++) {
      if (cells[col] && label.test(cells[col]!)) return { row, col };
    }
  }
  return null;
}

/** A cell that introduces another field rather than answering this one. */
function isAnotherLabel(cell: string): boolean {
  return /[:\-]\s*$/.test(cell) || /^(dated?|place\s*of\s*supply|invoice\s*no)/i.test(cell);
}

/**
 * The value belonging to a label: beneath it in the same column, or failing
 * that to its right on the same row.
 *
 * Beneath comes first because these templates lay their heading block out as
 * a little table — "INVOICE No-" over the number, "Dated" over the date —
 * and the cell to the right of one heading is the next heading, not a value.
 * Reading rightwards first returned "Dated" as the invoice number on every
 * file. Blank rows between the heading and its value are stepped over; the
 * template leaves one.
 */
export function labelledValue(
  grid: Grid,
  label: RegExp,
  isValue: (cell: string) => boolean = (cell) => !isAnotherLabel(cell)
): string {
  const at = findLabel(grid, label);
  if (!at) return "";

  for (let row = at.row + 1; row <= at.row + VALUE_SEARCH_DEPTH && row < grid.length; row++) {
    const cell = grid[row]?.[at.col];
    if (cell && isValue(cell)) return cell;
  }

  const sameRow = grid[at.row] ?? [];
  for (let col = at.col + 1; col < sameRow.length; col++) {
    if (sameRow[col] && isValue(sameRow[col]!)) return sameRow[col]!;
  }

  return "";
}

/** The last number on the row a label sits on — the amount the template totals into. */
export function labelledAmount(grid: Grid, label: RegExp): number {
  const at = findLabel(grid, label);
  if (!at) return 0;

  const cells = grid[at.row] ?? [];
  for (let col = cells.length - 1; col > at.col; col--) {
    const value = Number((cells[col] ?? "").replace(/[₹,\s]/g, ""));
    if (cells[col] && Number.isFinite(value) && value !== 0) return value;
  }
  return 0;
}

interface InvoiceItem {
  description: string;
  hsnCode: string;
  uqc: string;
  quantity: number;
  taxableValue: number;
}

/**
 * The goods, taken from the rows under the item header and stopping at the
 * first row that carries no description — which on this template is the
 * quantity subtotal, and after it the bank details and the signature block.
 */
function readItems(grid: Grid): InvoiceItem[] {
  const header = findLabel(grid, /description\s*of\s*goods/i);
  if (!header) return [];

  const columnsOf = (row: string[]) => ({
    description: row[header.col] ?? "",
    hsnCode: row[header.col + 1] ?? "",
    uqc: row[header.col + 2] ?? "",
    quantity: Number(row[header.col + 3] ?? "") || 0,
    taxableValue: Number((row[header.col + 5] ?? "").replace(/[₹,\s]/g, "")) || 0,
  });

  const items: InvoiceItem[] = [];
  for (let row = header.row + 1; row < grid.length; row++) {
    const cells = grid[row] ?? [];
    const item = columnsOf(cells);

    // The band that closes the item list. "Taxable Value" sits in the
    // description column with the total beside it and would otherwise be
    // read as a commodity worth the whole invoice.
    if (
      /^(taxable\s*value|less\s*discount|total|add\s*[cis]gst|bank\s*details)/i.test(
        item.description
      )
    )
      break;

    // The template leaves a blank row under the header and between bands, so
    // an empty row ends nothing.
    if (cells.every((cell) => !cell)) continue;

    // A commodity has an HSN. A subtotal row carries figures but no code.
    if (!/^\d{4,8}$/.test(item.hsnCode.replace(/\D/g, ""))) continue;
    if (/[A-Za-z]/.test(item.description) && item.taxableValue !== 0) items.push(item);
  }
  return items;
}

/**
 * Where the supply was made.
 *
 * The buyer's registration settles it outright. Failing that the tax charged
 * does: CGST and SGST mean the supply stayed in the seller's own state. Only
 * when the sale is inter-state and the buyer is unregistered is there nothing
 * to read but the address, and there the PIN code is the evidence — where it
 * names one state and one state only.
 */
function placeOfSupply(
  buyerGstin: string,
  supplierGstin: string,
  address: string,
  charged: { igst: number; cgst: number }
): string {
  if (buyerGstin.length >= 2) return buyerGstin.slice(0, 2);
  if (charged.cgst > 0 && supplierGstin.length >= 2) return supplierGstin.slice(0, 2);
  if (charged.igst > 0) {
    const pin = /\b(\d{6})\b/.exec(address)?.[1];
    if (pin) return stateFromPinCode(pin);
  }
  return "";
}

/**
 * Reads one printed invoice into the table the PDF path already produces, so
 * nothing downstream has to know where it came from.
 *
 * Returns null when the sheet prices no goods, leaving a blank or decorative
 * template to the ordinary table reader instead of turning it into an invoice
 * with nothing on it.
 */
export function invoiceDocumentToTable(
  sheetName: string,
  worksheet: XLSX.WorkSheet,
  fileName: string,
  supplierGstin = ""
): ReconstructedTable | null {
  const grid = sheetGrid(worksheet);
  const items = readItems(grid);
  if (items.length === 0) return null;

  const invoiceNumber = labelledValue(grid, /invoice\s*no\b/i);
  if (!invoiceNumber) return null;

  const allGstins = [...new Set(grid.flat().join("\n").match(GSTIN) ?? [])];
  const seller = supplierGstin || allGstins[0] || "";
  const buyerGstin = allGstins.find((g) => g !== seller) ?? "";

  const igst = labelledAmount(grid, /\bigst\b/i);
  const cgst = labelledAmount(grid, /\bcgst\b/i);
  const sgst = labelledAmount(grid, /\bsgst\b/i);

  const invoiceDate = transformDate(
    labelledValue(grid, /^dated?\b/i, (cell) => /\d/.test(cell) && !/[A-Za-z]{3}/.test(cell))
  );
  const buyerName = labelledValue(
    grid,
    /bill\s*to/i,
    (cell) => /[A-Za-z]/.test(cell) && !isAnotherLabel(cell)
  );
  const address = grid
    .flat()
    .filter((cell) => /address/i.test(cell))
    .join(" ");

  const pos = placeOfSupply(buyerGstin, seller, address, { igst, cgst });

  // The stated taxable value is what the seller charged tax on, and it is not
  // always the item total: this template subtracts a discount between the two.
  // Taking the item total instead made an invoice of 12,075 bear 600 of tax —
  // a rate of 4.97%, which is no slab, and a B2CS line the portal would not
  // recognise. The discount is spread back across the goods by value.
  const itemTotal = items.reduce((sum, item) => sum + item.taxableValue, 0);
  const stated = labelledAmount(grid, /^taxable\s*value/i);
  const taxableTotal = stated > 0 ? stated : itemTotal;
  const discountFactor = itemTotal === 0 ? 1 : taxableTotal / itemTotal;
  for (const item of items) {
    item.taxableValue = Math.round(item.taxableValue * discountFactor * 100) / 100;
  }

  const rows: Record<string, string>[] = items.map((item) => {
    // Tax is stated once for the invoice; it is split across the goods by
    // value so a multi-line invoice still sums back to what it charged.
    const share = taxableTotal === 0 ? 0 : item.taxableValue / taxableTotal;
    const rate =
      item.taxableValue === 0 ? 0 : ((igst + cgst + sgst) * share * 100) / item.taxableValue;
    return {
      "Invoice Number": invoiceNumber,
      "Invoice Date": invoiceDate,
      Type: buyerGstin ? "B2B" : "B2C",
      "Buyer Name": buyerName,
      "Buyer GSTIN": buyerGstin,
      "Place of Supply": pos && STATE_CODES[pos] ? `${pos}-${STATE_CODES[pos]}` : "",
      "HSN/SAC Code": item.hsnCode,
      "Item Description": item.description,
      UQC: item.uqc || "PCS",
      Quantity: String(item.quantity),
      "GST Rate (%)": String(Math.round(rate * 100) / 100),
      "Taxable Value (Rs)": String(item.taxableValue),
      "IGST (Rs)": String(Math.round(igst * share * 100) / 100),
      "CGST (Rs)": String(Math.round(cgst * share * 100) / 100),
      "SGST (Rs)": String(Math.round(sgst * share * 100) / 100),
      "Total Amount (Rs)": String(
        Math.round((item.taxableValue + (igst + cgst + sgst) * share) * 100) / 100
      ),
      "File Name": fileName,
    };
  });

  return {
    // Named for what it holds: "BILL NO. 10" is the seller's own tab heading
    // and repeats across every file they send.
    sheetName: `Invoice_Line_Items (${sheetName})`,
    headers: Object.keys(rows[0]!),
    rows,
    headerRowIndex: 0,
    headerRowSpan: 1,
    discarded: [],
    score: 100,
  };
}
