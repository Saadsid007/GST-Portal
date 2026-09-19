/**
 * Recovers an invoice's figures when its labels and values came apart.
 *
 * Reading a PDF gives text in drawing order, not reading order. On a great
 * many Indian invoices the amount column is emitted as one block and the
 * labels beside it as another, so the document says
 *
 *     78000.00  7020.00  7020.00  92040.00
 *     … Sub-total  SGST @9%  CGST @9%  TOTAL
 *
 * and every "label followed by a number" pattern finds nothing. Those
 * invoices came through with all values zero.
 *
 * Rather than chase layouts, this solves for the figures using the identity
 * every tax invoice satisfies:
 *
 *     taxable + tax = total,  and  tax / taxable is a notified slab
 *
 * with tax split equally as CGST and SGST within a state, or carried whole as
 * IGST across one. Three independent constraints over a few dozen numbers
 * leave almost no room for a coincidence, which is why this can be trusted
 * where a positional guess cannot.
 *
 * It is a fallback, not a replacement: an invoice whose labels do parse is
 * read from its labels, because that reflects what the document actually says.
 */

/** Slabs notified under the Act. A rate outside these is a misread, not a rate. */
const GST_SLABS = [0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];

/** Invoices carry a "rounded off" line, so the identity holds to the rupee. */
const TOLERANCE = 1.0;

/** Rate derived from amounts rarely lands exactly on the slab. */
const RATE_TOLERANCE = 0.15;

export interface ReconciledAmounts {
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalInvoiceValue: number;
  gstRate: number;
  /** How the split was decided, for the extraction note shown to the user. */
  basis: "intra-state" | "inter-state";
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function matchSlab(pct: number): number | null {
  return GST_SLABS.find((s) => Math.abs(s - pct) <= RATE_TOLERANCE) ?? null;
}

/**
 * Every money-looking figure in the document.
 *
 * Kept as a list rather than a set: a figure appearing twice is itself
 * evidence — an equal CGST and SGST pair is what makes an intra-state split
 * credible rather than assumed.
 */
export function collectAmounts(text: string): number[] {
  const out: number[] = [];
  // Requires either a decimal part or a thousands group, so quantities, HSN
  // codes, pincodes and years are not mistaken for money.
  //
  // The lookbehind excludes digits only. Excluding a preceding "." as well
  // skipped every figure written "Rs.319.47" — the dot of "Rs." blocked the
  // match — which is how a whole marketplace's invoices read as zero.
  const pattern = /(?<!\d)(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2})(?!\d)/g;

  for (const match of text.matchAll(pattern)) {
    const value = parseFloat(match[1]!.replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) out.push(r2(value));
  }
  return out;
}

function countOf(values: number[], target: number): number {
  return values.filter((v) => Math.abs(v - target) <= 0.02).length;
}

/**
 * Solves for the figures, or returns null when nothing fits.
 *
 * Returning null is the point: a document this cannot reconcile is one whose
 * numbers do not describe a single invoice, and inventing a split for it would
 * be worse than reporting that the file needs a look.
 */
export function reconcileAmounts(
  amounts: number[],
  options: { preferInterState?: boolean } = {}
): ReconciledAmounts | null {
  const unique = [...new Set(amounts)].sort((a, b) => b - a);
  if (unique.length < 2) return null;

  const solutions: ReconciledAmounts[] = [];

  for (const total of unique) {
    for (const taxable of unique) {
      if (taxable >= total) continue;

      const tax = r2(total - taxable);
      if (tax <= 0) continue;

      const slab = matchSlab((tax / taxable) * 100);
      if (slab === null) continue;

      // Intra-state: the tax is halved, and both halves must be printed.
      const half = r2(tax / 2);
      if (Math.abs(half * 2 - tax) <= 0.02 && countOf(amounts, half) >= 2) {
        solutions.push({
          taxableValue: taxable,
          cgstAmount: half,
          sgstAmount: half,
          igstAmount: 0,
          totalInvoiceValue: total,
          gstRate: slab,
          basis: "intra-state",
        });
      }

      // Inter-state: the tax is printed whole.
      if (countOf(amounts, tax) >= 1) {
        solutions.push({
          taxableValue: taxable,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: tax,
          totalInvoiceValue: total,
          gstRate: slab,
          basis: "inter-state",
        });
      }
    }
  }

  if (solutions.length === 0) return null;

  const wantInter = options.preferInterState === true;

  // The invoice total is the largest figure that reconciles — a smaller one is
  // a line or a sub-total that happens to fit. Where both splits fit the same
  // pair, the supplier's and buyer's states decide, not chance.
  solutions.sort((a, b) => {
    if (Math.abs(a.totalInvoiceValue - b.totalInvoiceValue) > TOLERANCE) {
      return b.totalInvoiceValue - a.totalInvoiceValue;
    }
    const aMatches = (a.basis === "inter-state") === wantInter;
    const bMatches = (b.basis === "inter-state") === wantInter;
    if (aMatches !== bMatches) return aMatches ? -1 : 1;
    return b.taxableValue - a.taxableValue;
  });

  return solutions[0]!;
}

/**
 * True when what the label-driven pass read does not describe one invoice.
 *
 * Used to decide whether to fall back: figures that fail their own identity
 * are not better than no figures, they are quietly wrong ones.
 */
export function amountsAreConsistent(a: {
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalInvoiceValue: number;
}): boolean {
  if (a.taxableValue <= 0 || a.totalInvoiceValue <= 0) return false;

  const tax = a.cgstAmount + a.sgstAmount + a.igstAmount + a.cessAmount;
  if (Math.abs(a.taxableValue + tax - a.totalInvoiceValue) > TOLERANCE) return false;

  // A zero-rated supply is legitimate and needs no slab check.
  if (tax === 0) return true;

  return matchSlab((tax / a.taxableValue) * 100) !== null;
}
