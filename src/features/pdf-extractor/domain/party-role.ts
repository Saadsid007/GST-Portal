/**
 * Which side of a document the seller's own registration is on.
 *
 * A folder of invoices handed over for GSTR-1 holds the bills the seller
 * received as well as the ones it issued: Amazon's monthly fee invoices, a
 * payment gateway's charges, a courier's freight bill, a supplier's bill for
 * packing material. Each carries the seller's GSTIN — under "Bill to". Read as
 * sales, Amazon became the buyer of the seller's goods and a lakh of fees and
 * purchases was declared as turnover.
 *
 * The label nearest before the seller's GSTIN says which party it belongs to.
 */
export type PartyRole = "supplier" | "recipient" | "absent";

// "Customer" alone is not here: "Customer care: 1800…" heads many a seller's
// own letterhead, above its own GSTIN.
const RECIPIENT_LABEL =
  /\b(bill(ed)?\s*to|ship(ped)?\s*to|buyer|recipient|consignee|details\s*of\s*receiver|sold\s*to|customer\s*(name|details|gstin)|account\s*billed)\b|^\s*to\s*,?\s*$/gim;
const SUPPLIER_LABEL =
  /\b(sold\s*by|seller|supplier|details\s*of\s*supplier|bill(ed)?\s*from|ship(ped)?\s*from|dispatch(ed)?\s*from)\b/gi;
const ANY_GSTIN = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g;

/** Close enough that the label can only be introducing this GSTIN's party. */
const ADJACENT = 400;

function lastMatchBefore(pattern: RegExp, text: string, end: number): number {
  let last = -1;
  for (const match of text.slice(0, end).matchAll(pattern)) last = match.index ?? last;
  return last;
}

export function ownGstinRole(text: string, ownGstin: string): PartyRole {
  const gstin = ownGstin.trim().toUpperCase();
  if (gstin.length !== 15) return "absent";

  const upper = text.toUpperCase();
  const at = upper.indexOf(gstin);
  if (at < 0) return "absent";

  const recipient = lastMatchBefore(RECIPIENT_LABEL, text, at);
  const supplier = lastMatchBefore(SUPPLIER_LABEL, text, at);
  if (recipient <= supplier) return "supplier";

  // Nearest is not enough on its own. A two-column header flattens to "Ship
  // from : Ship to :" on one line, and the seller's GSTIN, under "Ship from",
  // then follows the later label — seven of Amazon's own stock-transfer
  // challans and a Vendor Central invoice read as bills received. One of two
  // things must also hold: someone else's GSTIN heads the page, as an
  // issuer's letterhead does; or nothing before the seller's GSTIN names a
  // sender at all, the page speaking only of whom it is billed to.
  const others = [...upper.matchAll(ANY_GSTIN)].filter((m) => m[0] !== gstin);
  const issuerFirst = others.some((m) => (m.index ?? Infinity) < at);
  if (issuerFirst) return "recipient";
  if (supplier >= 0) return "supplier";

  // A bill received is issued by someone — registered in India, with a GSTIN
  // of its own somewhere on the page, or a foreign platform billing a named
  // account right above the seller's GSTIN. Without either, a label somewhere
  // up the page is too little to take a sale out of the return.
  return others.length > 0 || at - recipient <= ADJACENT ? "recipient" : "supplier";
}
