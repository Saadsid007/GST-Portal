import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Meesho's "Tax invoice details" sheet, and what it fixes.
 *
 * The TCS export (`tcs_sales.xlsx`) identifies a supply only by
 * `sub_order_num` — a number like `312587738666181376_1`. That is an order
 * reference, not an invoice number, and using it as one has two consequences
 * that reach the filed return:
 *
 *   Table 13 becomes fiction. Documents issued is a count per invoice *series*,
 *   and every order id is its own series of one. A seller who issued 33
 *   invoices in the series `ly5kw27…` was reporting 33 separate series instead.
 *
 *   The invoice number on the return does not match the invoice the customer
 *   holds, so nothing reconciles against the actual PDF.
 *
 * The details sheet carries the mapping Meesho keeps to itself elsewhere:
 * suborder → real invoice number, plus the commodity HSN and the product
 * description. It is an index, not a source of values — no taxable amount
 * appears in it — so it enriches rows rather than creating them.
 */

export interface InvoiceDetail {
  invoiceNumber: string;
  hsnCode?: string;
  description?: string;
  /** INVOICE, CREDIT NOTE, CREDIT_DISCOUNT, CREDIT_CONVERSION. */
  documentType?: string;
}

export type InvoiceDetailsIndex = Map<string, InvoiceDetail>;

const SUBORDER_HEADERS = ["suborder no.", "suborder no", "sub_order_num", "suborder number"];
const INVOICE_HEADERS = ["invoice no.", "invoice no", "invoice number"];

function valueOf(row: Record<string, string>, candidates: string[]): string {
  for (const [key, value] of Object.entries(row)) {
    if (candidates.includes(key.trim().toLowerCase())) {
      const text = String(value ?? "").trim();
      if (text) return text;
    }
  }
  return "";
}

/**
 * True when this sheet is the suborder→invoice index rather than transactions.
 *
 * Both columns are required. A sheet with only an invoice number is an
 * ordinary register and belongs to the adapter that reads values.
 */
export function isInvoiceDetailsSheet(headers: string[]): boolean {
  const normalised = headers.map((h) => h.trim().toLowerCase());
  const hasSuborder = normalised.some((h) => SUBORDER_HEADERS.includes(h));
  const hasInvoice = normalised.some((h) => INVOICE_HEADERS.includes(h));
  return hasSuborder && hasInvoice;
}

export function parseInvoiceDetails(rows: Record<string, string>[]): InvoiceDetailsIndex {
  const index: InvoiceDetailsIndex = new Map();

  for (const row of rows) {
    const suborder = valueOf(row, SUBORDER_HEADERS);
    const invoiceNumber = valueOf(row, INVOICE_HEADERS);
    if (!suborder || !invoiceNumber) continue;

    index.set(suborder, {
      invoiceNumber,
      hsnCode: valueOf(row, ["hsn", "hsn code", "hsn_code"]) || undefined,
      description: valueOf(row, ["product description", "product name"]) || undefined,
      documentType: valueOf(row, ["type", "document type"]) || undefined,
    });
  }

  return index;
}

/**
 * The TCS export truncates long references, and the transformation engine
 * keeps only the last 16 characters of an invoice number to satisfy the GSTR-1
 * field limit. Matching therefore tries the full suborder first and falls back
 * to its tail, so an already-shortened row still finds its entry.
 */
function lookup(index: InvoiceDetailsIndex, reference: string): InvoiceDetail | undefined {
  const direct = index.get(reference);
  if (direct) return direct;

  for (const [suborder, detail] of index) {
    if (suborder.endsWith(reference) || reference.endsWith(suborder)) return detail;
  }
  return undefined;
}

/**
 * Replaces order references with the invoice numbers actually issued.
 *
 * Only Meesho rows are touched, and only where the index has an entry: a row
 * left unmatched keeps its order reference, which is wrong but visible, rather
 * than being silently paired with someone else's invoice.
 */
export function applyInvoiceDetails(
  rows: NormalizedInvoiceRow[],
  index: InvoiceDetailsIndex
): NormalizedInvoiceRow[] {
  if (index.size === 0) return rows;

  return rows.map((row) => {
    if (row.sourcePlatformId !== "meesho") return row;

    const detail = lookup(index, row.invoiceNumber);
    if (!detail) return row;

    return {
      ...row,
      invoiceNumber: detail.invoiceNumber,
      // The export's own HSN wins when it has one; the index fills the gap.
      hsnCode: row.hsnCode || detail.hsnCode || "",
      // The index description comes off the tax invoice itself, so it beats
      // the placeholder the TCS export forces the adapter to invent
      // ("Meesho Order 3125877…"), which describes no commodity at all and
      // would be carried into the Table 12 description column.
      itemDescription: detail.description ?? row.itemDescription,
    };
  });
}
