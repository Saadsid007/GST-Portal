import * as XLSX from "xlsx";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";
import { transformDate } from "@/features/convert/engine/transformation/transformers";
import { stateFromPinCode, STATE_CODES } from "@/features/convert/domain/state-codes";
import type { ExtractedInvoice, ExtractedLineItem } from "@/features/pdf-extractor/domain/types";

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

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
const DOCUMENT_HEADING =
  /\b(tax\s*invoice|bill\s*of\s*supply|delivery\s*challan|proforma|credit\s*note)\b/i;
const REGISTER_COLUMN = /\b(invoice|document|bill)\s*(number|no\.?|date|id)\b/i;

/**
 * The label a template puts before its document number. "Inovice" is not a
 * guess: it is how one seller's template spells it on every bill.
 */
const NUMBER_LABEL = /\b(invoice|inovice|credit\s*note)\s*(no\b|number)/i;
const DATE_LABEL =
  /^(dated?|(invoice|inovice|credit\s*note)\s*date|date\s*of\s*(invoice|inovice|issue))\b/i;

/** A one-line statement of the whole tax: "Tax 18%=", "GST 18 % =", "IGST 18 % =". */
const STATED_TAX = /^(total\s*)?(tax|gst|igst)\s*@?\s*\d+(\.\d+)?\s*%?\s*[=:]/i;

/** Rows that close the list of goods: totals, tax lines, bank details. */
const TOTALS_BAND =
  /^(sub\s*total|total\b|taxable\s*value|less\s*discount|add\s*[cis]gst|bank\s*details|amount\s*\(?\s*in\s*words|other\s*charges)/i;

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
  // Not every template prints a title. A calibration lab's bills open with
  // the company letterhead and go straight to "Invoice No.:" — the labelled
  // number is as sure a sign of one document as a heading is.
  const heading = grid
    .slice(0, 15)
    .flat()
    .some((cell) => DOCUMENT_HEADING.test(cell) || NUMBER_LABEL.test(cell));
  if (!heading) return false;

  // Where the goods are listed, a register names each line's document in the
  // same header row — "Invoice Number | Description | HSN | Amount". A printed
  // invoice never does; its number is in the heading block above. The table
  // reader's own choice of header row is no guide here: on a bill it can pick
  // the heading block, whose "Invoice No." then looked like a register column.
  const items = findItemColumns(grid);
  if (items) return !(grid[items.row] ?? []).some((cell) => REGISTER_COLUMN.test(cell));

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
  return (
    /[:\-=]\s*$/.test(cell) ||
    /^(dated?|place\s*of\s*supply|invoice\s*no)/i.test(cell) ||
    NUMBER_LABEL.test(cell) ||
    DATE_LABEL.test(cell)
  );
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
 *
 * In each direction only the first filled cell is considered. When that cell
 * is another label, the value is not that way: other templates list their
 * labels in a column ("Invoice No.:" over "Invoice Date:" over "Consignee")
 * with each value to the right, and reading on down the column returned
 * "Consignee" as the invoice number. The value may also sit one column to
 * the right of its label's column — a merged heading cell stores its text in
 * the first column and the typed value lands under the second.
 */
export function labelledValue(
  grid: Grid,
  label: RegExp,
  isValue: (cell: string) => boolean = () => true
): string {
  const at = findLabel(grid, label);
  if (!at) return "";
  const accept = (cell: string) => !isAnotherLabel(cell) && isValue(cell);

  for (let row = at.row + 1; row <= at.row + VALUE_SEARCH_DEPTH && row < grid.length; row++) {
    const cells = grid[row] ?? [];
    const cell = cells[at.col] || cells[at.col + 1];
    if (!cell) continue;
    if (accept(cell)) return cell;
    break;
  }

  const sameRow = grid[at.row] ?? [];
  for (let col = at.col + 1; col < sameRow.length; col++) {
    const cell = sameRow[col];
    if (!cell) continue;
    return accept(cell) ? cell : "";
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
  /** The rate the template prints against the line, when it prints one. */
  rate: number;
}

interface ItemColumns {
  row: number;
  description: number;
  hsn: number;
  uqc: number;
  quantity: number;
  rate: number;
  amount: number;
}

const amountOf = (cell: string | undefined) => Number((cell ?? "").replace(/[₹,\s]/g, "")) || 0;

/**
 * The row that heads the list of goods, with each column found by what it
 * is called.
 *
 * Fixed offsets from the description column fitted exactly one template.
 * Another puts the GST rate between the description and the HSN, a third
 * spreads its columns over merged cells so the HSN sits seven columns along
 * — read by position, each of them priced every line at its quantity and
 * never found a code.
 */
function findItemColumns(grid: Grid): ItemColumns | null {
  for (let row = 0; row < grid.length; row++) {
    const cells = grid[row] ?? [];
    const find = (pattern: RegExp) => cells.findIndex((cell) => pattern.test(cell));

    const description = find(/description|particulars|item\s*name/i);
    const hsn = find(/\b(hsn|sac)\b/i);
    if (description < 0 || hsn < 0) continue;

    // The line total is the right-most money column; "Rate" to its left is
    // the unit price.
    let amount = -1;
    cells.forEach((cell, col) => {
      if (/amount|taxable\s*value/i.test(cell)) amount = col;
    });
    if (amount < 0) continue;

    return {
      row,
      description,
      hsn,
      uqc: find(/^\s*(uqc|units?|uom)\.?\s*$/i),
      quantity: find(/^\s*(qty|quantity)\b/i),
      rate: find(/(gst|tax)\s*rate|gst\s*%|rate\s*%/i),
      amount,
    };
  }
  return null;
}

/**
 * The goods, taken from the rows under the item header and stopping at the
 * band that totals them — after which come the tax lines, the bank details
 * and the signature block.
 */
function readItems(grid: Grid): InvoiceItem[] {
  const columns = findItemColumns(grid);
  if (!columns) return [];
  const at = (cells: string[], col: number) => (col < 0 ? "" : (cells[col] ?? ""));

  const items: InvoiceItem[] = [];
  for (let row = columns.row + 1; row < grid.length; row++) {
    const cells = grid[row] ?? [];
    const description = at(cells, columns.description);
    const first = cells.find(Boolean) ?? "";

    // "Taxable Value" or "Sub Total" in the description column, "Total
    // Quantity" in the serial column, a bare "TOTAL" beside the amount: each
    // closes the list, and the figure beside it would otherwise be read as a
    // commodity worth the whole invoice.
    if (
      TOTALS_BAND.test(description) ||
      TOTALS_BAND.test(first) ||
      cells.some((cell) => /^(sub\s*)?total\s*[:=]?$/i.test(cell))
    )
      break;

    // Numbered blank lines, a subtotal of quantities, a description carried
    // onto a second row: none is a priced good.
    const taxableValue = amountOf(at(cells, columns.amount));
    if (!/[A-Za-z]/.test(description) || taxableValue === 0) continue;

    // A code is kept only when it looks like one. A missing code is left
    // blank for the validator to ask for, not a reason to drop the sale.
    const digits = at(cells, columns.hsn).replace(/\D/g, "");
    const printedRate = amountOf(at(cells, columns.rate));

    items.push({
      description,
      hsnCode: /^\d{4,8}$/.test(digits) ? digits : "",
      uqc: at(cells, columns.uqc),
      quantity: Number(at(cells, columns.quantity)) || 0,
      taxableValue,
      // "0.05" in one template, "18" in another.
      rate: printedRate > 0 && printedRate < 1 ? r2(printedRate * 100) : printedRate,
    });
  }
  return items;
}

/** The last non-zero figure on a row — where these templates put the amount. */
function lastAmount(cells: string[]): number {
  for (let col = cells.length - 1; col >= 0; col--) {
    const value = amountOf(cells[col]);
    if (value !== 0) return value;
  }
  return 0;
}

/**
 * The value the seller charged tax on, when the bill does not print it but
 * adjusts the goods total on its way to the tax line.
 *
 * "Site charges= 500", "Courier Charges = 200": charges the supplier bills
 * with the supply are part of its value (CGST Act s.15(2)(c)) and bear the
 * same tax — on every such bill the tax is exactly the rate on goods plus
 * charges. "after 20% Discount= 7200" states the net outright. Taking the
 * goods total alone made a bill of 2,247 bearing 404.46 of tax read as 1,747
 * at 23.15%, a rate that exists nowhere.
 */
function chargedValue(grid: Grid, itemTotal: number): number {
  let base = itemTotal;
  let charges = 0;
  for (const cells of grid) {
    const label = cells.find(Boolean) ?? "";
    if (/^after\b.*discount\s*[=:]?\s*$/i.test(label)) base = lastAmount(cells) || base;
    else if (/charges?\s*[=:]\s*$/i.test(label) && !/^total\b/i.test(label))
      charges += lastAmount(cells);
  }
  return r2(base + charges);
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
 * Reads one printed invoice off its sheet.
 *
 * The single implementation: the conversion pipeline turns this into rows,
 * and the standalone extractor shows it beside the invoices it read from
 * PDFs. Neither has a reading of its own.
 *
 * Returns null when the sheet prices no goods or names no invoice, leaving a
 * blank or decorative template to the ordinary table reader rather than
 * becoming an invoice with nothing on it.
 */
export function readInvoiceSheet(
  worksheet: XLSX.WorkSheet,
  fileName: string,
  supplierGstin = ""
): ExtractedInvoice | null {
  const grid = sheetGrid(worksheet);
  const items = readItems(grid);
  if (items.length === 0) return null;

  const invoiceNumber = labelledValue(grid, NUMBER_LABEL);
  if (!invoiceNumber) return null;

  // A credit note is headed as one, or at least labels its number as one. One
  // lab's notes do neither — the template still says "Invoice No." — but they
  // are numbered CN-07, CN-08…, and the accountant's own reconciliation files
  // every one of them as a credit note. The file name is no help: some are
  // "Note Credit", one is just the customer's name.
  const isCreditNote =
    grid
      .slice(0, 15)
      .flat()
      .some((cell) => /credit\s*note/i.test(cell)) || /^CN[-/\s]?\d/i.test(invoiceNumber);

  const allGstins = [...new Set(grid.flat().join("\n").match(GSTIN) ?? [])];

  // A registration the caller supplied is only this invoice's supplier if the
  // invoice says so. The extractor page passes whichever GSTIN the profile
  // holds, and a user working through several clients had another one there:
  // taken on trust it made the real seller the buyer, turned an inter-state
  // sale into an intra-state one, and every row failed on the tax split.
  // The document outranks the setting.
  const seller = allGstins.includes(supplierGstin)
    ? supplierGstin
    : (allGstins[0] ?? supplierGstin);
  // A buyer's GSTIN typed wrong on the bill ("09AASCM4127D12C") is still the
  // buyer's GSTIN: kept, the sale stays B2B and the validator names the bad
  // character. Dropped, it became an anonymous B2C sale and the error that
  // needed fixing was never shown.
  const typedGstins = grid
    .filter((row) => row.some((cell) => /gstin/i.test(cell)))
    .flat()
    .flatMap((cell) => cell.toUpperCase().match(/\b\d{2}[A-Z0-9]{13}\b/g) ?? []);
  const buyerGstin =
    allGstins.find((g) => g !== seller) ?? typedGstins.find((g) => g !== seller) ?? "";

  const igst = labelledAmount(grid, /\bigst\b/i);
  const cgst = labelledAmount(grid, /\bcgst\b/i);
  const sgst = labelledAmount(grid, /\bsgst\b/i);

  const invoiceDate = transformDate(
    labelledValue(grid, DATE_LABEL, (cell) => /\d/.test(cell) && !/[A-Za-z]{3}/.test(cell))
  );
  const isName = (cell: string) => /[A-Za-z]/.test(cell);
  const buyerName =
    labelledValue(grid, /bill(ed)?\s*to/i, isName) || labelledValue(grid, /^name\b/i, isName);

  // The whole row, not only the labelled cell: most templates put the
  // address in the cell beside "Address:", where the PIN code is.
  const address = grid
    .filter((row) => row.some((cell) => /^address\b/i.test(cell)))
    .flat()
    .join(" ");

  const pos = placeOfSupply(buyerGstin, seller, address, { igst, cgst });

  // The stated taxable value is what the seller charged tax on, and it is not
  // always the item total: this template subtracts a discount between the two.
  // Taking the item total instead made an invoice of 12,075 bear 600 of tax —
  // a rate of 4.97%, which is no slab, and a B2CS line the portal would not
  // recognise. The discount is spread back across the goods by value.
  const itemTotal = items.reduce((sum, item) => sum + item.taxableValue, 0);
  const stated = labelledAmount(grid, /^taxable\s*value/i);
  const taxableTotal = stated > 0 ? stated : chargedValue(grid, itemTotal);
  const discountFactor = itemTotal === 0 ? 1 : taxableTotal / itemTotal;
  for (const item of items) {
    item.taxableValue = Math.round(item.taxableValue * discountFactor * 100) / 100;
  }
  // Rounding each share leaves the lines a few paise off the stated value;
  // the last line takes the difference so the invoice adds up to what it says.
  const last = items[items.length - 1];
  if (last && discountFactor !== 1) {
    last.taxableValue = r2(
      last.taxableValue + taxableTotal - items.reduce((sum, item) => sum + item.taxableValue, 0)
    );
  }

  // The tax the bill states in one line — "Tax 18%= 5688", "GST 18 % =" —
  // outranks its breakdown box. Sellers copy that box from bill to bill and
  // edit it by hand: one printed "CGST 9% 2844" twice for a note of 5688, and
  // summed it read as half the tax.
  const statedTax = labelledAmount(grid, STATED_TAX);
  const totalTax = statedTax > 0 ? statedTax : r2(igst + cgst + sgst);
  const rate = taxableTotal === 0 ? 0 : r2((totalTax * 100) / taxableTotal);

  // Which tax applies is the law's, not the template's: a supply to another
  // state bears IGST, one within the state CGST and SGST. The portal accepts
  // nothing else, and the accountant's own return files these bills that way.
  // Where the place of supply is unknown the bill's own choice stands.
  const sellerState = seller.slice(0, 2);
  const interState = pos && sellerState ? pos !== sellerState : igst > 0;
  const split = interState
    ? { igst: totalTax, cgst: 0, sgst: 0 }
    : { igst: 0, cgst: r2(totalTax / 2), sgst: r2(totalTax - r2(totalTax / 2)) };
  const notes: string[] = [];
  if (!pos)
    notes.push(
      "Place of supply could not be read: the buyer is unregistered and the PIN code on the address is shared by more than one state."
    );
  if (totalTax > 0 && (interState ? cgst + sgst > 0 : igst > 0))
    notes.push(
      interState
        ? "The bill charges CGST and SGST on a supply to another state; it is reported as IGST, which is what the law requires. Correct the bill."
        : "The bill charges IGST on a supply within the state; it is reported as CGST and SGST, which is what the law requires. Correct the bill."
    );

  // Tax is stated once for the invoice; it is split across the goods by value
  // so a multi-line invoice still sums back to what it charged.
  const lineItems: ExtractedLineItem[] = items.map((item) => {
    const share = taxableTotal === 0 ? 0 : item.taxableValue / taxableTotal;
    return {
      itemDescription: item.description,
      hsnCode: item.hsnCode,
      uqc: item.uqc || "PCS",
      quantity: item.quantity,
      // A bill that prints no tax lines still prints the rate on each good;
      // the tax is then worked out from it downstream rather than read as nil.
      rate: totalTax === 0 && item.rate > 0 ? item.rate : rate,
      taxableValue: item.taxableValue,
      igstRate: interState ? rate : 0,
      cgstRate: interState ? 0 : r2(rate / 2),
      sgstRate: interState ? 0 : r2(rate / 2),
      cessRate: 0,
      igstAmount: r2(split.igst * share),
      cgstAmount: r2(split.cgst * share),
      sgstAmount: r2(split.sgst * share),
      cessAmount: 0,
      totalAmount: r2(item.taxableValue + totalTax * share),
    };
  });

  return {
    id: crypto.randomUUID(),
    fileName,
    fileSizeBytes: 0,
    pageCount: 1,
    invoiceNumber,
    invoiceDate,
    classification: isCreditNote ? (buyerGstin ? "CDNR" : "CDNUR") : buyerGstin ? "B2B" : "B2CS",
    documentType: isCreditNote ? "Credit Note" : "Invoice",
    supplierName: grid[1]?.[0] ?? "",
    supplierGstin: seller,
    buyerName: buyerName || (buyerGstin ? "Registered Buyer" : "Consumer"),
    buyerGstin,
    placeOfSupply: pos,
    placeOfSupplyStateName: pos && STATE_CODES[pos] ? STATE_CODES[pos]! : "",
    reverseCharge: false,
    taxableValue: taxableTotal,
    igstAmount: split.igst,
    cgstAmount: split.cgst,
    sgstAmount: split.sgst,
    cessAmount: 0,
    totalTaxAmount: totalTax,
    totalInvoiceValue: r2(taxableTotal + totalTax),
    gstRate: rate,
    lineItems,
    rawText: grid
      .map((row) => row.filter(Boolean).join("  "))
      .filter(Boolean)
      .join("\n"),
    confidenceScore: pos ? 100 : 70,
    notes,
  };
}

/**
 * The same invoice as a table, for the conversion pipeline.
 *
 * Shaped exactly like the table a PDF invoice produces, so nothing
 * downstream has to know which of the two it came from.
 */
export function invoiceDocumentToTable(
  sheetName: string,
  worksheet: XLSX.WorkSheet,
  fileName: string,
  supplierGstin = ""
): ReconstructedTable | null {
  const invoice = readInvoiceSheet(worksheet, fileName, supplierGstin);
  if (!invoice) return null;

  const rows: Record<string, string>[] = invoice.lineItems.map((item) => ({
    "Invoice Number": invoice.invoiceNumber,
    "Invoice Date": invoice.invoiceDate,
    Type: invoice.buyerGstin ? "B2B" : "B2C",
    "Document Type": invoice.documentType,
    "Buyer Name": invoice.buyerName,
    "Buyer GSTIN": invoice.buyerGstin,
    "Place of Supply": invoice.placeOfSupply
      ? `${invoice.placeOfSupply}-${invoice.placeOfSupplyStateName}`
      : "",
    "HSN/SAC Code": item.hsnCode,
    "Item Description": item.itemDescription,
    UQC: item.uqc,
    Quantity: String(item.quantity),
    "GST Rate (%)": String(item.rate),
    "Taxable Value (Rs)": String(item.taxableValue),
    "IGST (Rs)": String(item.igstAmount),
    "CGST (Rs)": String(item.cgstAmount),
    "SGST (Rs)": String(item.sgstAmount),
    "Total Amount (Rs)": String(item.totalAmount),
    "File Name": fileName,
  }));

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
