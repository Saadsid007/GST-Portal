import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Gives a note the commodity of the sale it adjusts.
 *
 * A marketplace issues some notes after the sale, in a sheet of their own —
 * Flipkart's cash back credit and debit notes are one — and those sheets have
 * no HSN column. Each note names its order line, though, and that order's sale
 * does carry an HSN. Left without one, the notes fell out of Table 12 while
 * still counting in Table 7, and the two disagreed by the notes' value.
 *
 * Only the classification is taken: the note keeps its own value, date, place
 * of supply and tax. And only from a sale of the same order line, so nothing is
 * inferred that the seller did not already declare.
 */
export function inheritCommodityByOrder(rows: NormalizedInvoiceRow[]): void {
  const saleByOrder = new Map<string, NormalizedInvoiceRow>();
  for (const row of rows) {
    const order = row.orderReference?.trim();
    if (!order || !row.hsnCode?.trim() || saleByOrder.has(order)) continue;
    saleByOrder.set(order, row);
  }

  for (const row of rows) {
    if (row.hsnCode?.trim()) continue;
    const order = row.orderReference?.trim();
    const sale = order ? saleByOrder.get(order) : undefined;
    if (!sale) continue;

    row.hsnCode = sale.hsnCode;
    if (!row.itemDescription) row.itemDescription = sale.itemDescription;
    if (!row.uqc || row.uqc === "OTH") row.uqc = sale.uqc;
    // The review raised for the missing code no longer applies.
    row.reviews = row.reviews?.filter((r) => !/HSN/i.test(r));
  }
}
