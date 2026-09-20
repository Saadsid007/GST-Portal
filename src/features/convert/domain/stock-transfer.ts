import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Stock moved between two registrations of one business.
 *
 * Whether that belongs in the return depends on whether tax was charged, not
 * on the fact that both ends share a PAN — see `isReportableTransfer`.
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

/** Tax below this is rounding, not a charge. */
const TAX_EPSILON = 0.01;

function taxCharged(r: NormalizedInvoiceRow): number {
  return Math.abs(r.igstAmount) + Math.abs(r.cgstAmount) + Math.abs(r.sgstAmount);
}

/**
 * Whether a transfer has to be declared in the return.
 *
 * A supply between two registrations of one business is still a supply —
 * Schedule I treats distinct persons as distinct even without consideration —
 * and when the seller has charged tax on it, it is an outward supply of this
 * return and belongs in Table 4 like any other B2B invoice. That is what the
 * filed returns do.
 *
 * A movement carrying no tax is the other case: goods sent under a delivery
 * challan for job work or on approval, which is a movement and not a supply.
 * The tax on the document is what separates the two, so that is what is read
 * — not the wording of the challan, which says "Stock Transfer" either way.
 */
export function isReportableTransfer(r: NormalizedInvoiceRow, supplierGstin: string): boolean {
  return isStockTransferRow(r, supplierGstin) && taxCharged(r) > TAX_EPSILON;
}

/**
 * The rows of a return that are outward supplies.
 *
 * Only an untaxed movement of the seller's own stock is held back.
 */
export function excludeStockTransfers(
  rows: NormalizedInvoiceRow[],
  supplierGstin: string
): NormalizedInvoiceRow[] {
  return rows.filter(
    (r) => !isStockTransferRow(r, supplierGstin) || isReportableTransfer(r, supplierGstin)
  );
}

/** What was held back as an untaxed movement, so the omission can be shown. */
export function summariseStockTransfers(
  rows: NormalizedInvoiceRow[],
  supplierGstin: string
): { rows: number; taxableValue: number } {
  const held = rows.filter(
    (r) => isStockTransferRow(r, supplierGstin) && !isReportableTransfer(r, supplierGstin)
  );
  const taxableValue = held.reduce((sum, r) => sum + r.taxableValue, 0);
  return {
    rows: held.length,
    taxableValue: Math.round((taxableValue + Number.EPSILON) * 100) / 100,
  };
}
