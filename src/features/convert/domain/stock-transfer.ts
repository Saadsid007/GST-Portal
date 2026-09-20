import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Moving your own stock between your own registrations is not a supply to a
 * customer, so it is not an outward supply of GSTR-1 — it must not appear in
 * Table 4 (B2B), in Table 12, or in the document series of Table 13.
 *
 * Shared by both generators. They had grown separate tests: the JSON one knew
 * about the PAN rule and the Amazon transfer feeds, the Excel one only looked
 * at the platform id and the file name, and used it for Table 14 alone. So the
 * same return shipped a JSON that excluded a branch transfer and an Excel that
 * declared it as a sale.
 */

/** Length of the PAN inside a 15-character GSTIN. */
const PAN_START = 2;
const PAN_END = 12;

function pan(gstin: string): string {
  return gstin.length >= PAN_END ? gstin.substring(PAN_START, PAN_END).toUpperCase() : "";
}

/**
 * Whether the row moves stock between two registrations of the same business.
 *
 * `supplierGstin` is the registration the return is being filed for.
 *
 * The PAN test is the general one: two GSTINs sharing a PAN are two
 * registrations of one legal person, so a document between them is a transfer
 * however it was labelled. A delivery challan the user extracted from a PDF
 * arrives typed "B2B" with a buyer GSTIN of the seller's own branch, and only
 * this test catches it.
 */
export function isStockTransferRow(r: NormalizedInvoiceRow, supplierGstin: string): boolean {
  if (r.sourcePlatformId === "amazon_stock_transfer" || r.sourcePlatformId === "stock_transfer")
    return true;

  const sourceFile = r.sourceFileName?.toLowerCase() ?? "";
  if (sourceFile.includes("stock_transfer")) return true;

  const transactionType = r.transactionType as string;
  if (transactionType === "FC_TRANSFER" || transactionType === "FC_REMOVAL") return true;

  // Amazon's own transfer and removal series, which arrive with no feed of
  // their own when the seller exports a combined register.
  if (/-(T|D)-\d+$/i.test(r.invoiceNumber) || r.invoiceNumber.startsWith("AFT-")) return true;

  const buyerPan = pan(r.buyerGstin ?? "");
  const sellerPan = pan(supplierGstin ?? "");
  return buyerPan !== "" && buyerPan === sellerPan;
}

/** The rows of a return that are genuine outward supplies. */
export function excludeStockTransfers(
  rows: NormalizedInvoiceRow[],
  supplierGstin: string
): NormalizedInvoiceRow[] {
  return rows.filter((r) => !isStockTransferRow(r, supplierGstin));
}

/** What was held back, so the omission can be shown rather than discovered. */
export function summariseStockTransfers(
  rows: NormalizedInvoiceRow[],
  supplierGstin: string
): { rows: number; taxableValue: number } {
  const held = rows.filter((r) => isStockTransferRow(r, supplierGstin));
  const taxableValue = held.reduce((sum, r) => sum + r.taxableValue, 0);
  return {
    rows: held.length,
    taxableValue: Math.round((taxableValue + Number.EPSILON) * 100) / 100,
  };
}
