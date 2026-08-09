import type {
  NormalizedInvoiceRow,
  PlatformContribution,
} from "@/features/convert/types/convert.types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface NetSalesResult {
  processedRows: NormalizedInvoiceRow[];

  // Gross Sales
  totalSalesTaxable: number;
  totalSalesCgst: number;
  totalSalesSgst: number;
  totalSalesIgst: number;
  totalSalesCess: number;
  totalSalesTax: number;

  // Gross Returns
  totalReturnTaxable: number;
  totalReturnCgst: number;
  totalReturnSgst: number;
  totalReturnIgst: number;
  totalReturnCess: number;
  totalReturnTax: number;

  // Net Sales
  netTaxable: number;
  netCgst: number;
  netSgst: number;
  netIgst: number;
  netCess: number;
  netTax: number;
  netGrandTotal: number;

  // Category counts & net taxable breakdown
  b2bCount: number;
  b2clCount: number;
  b2csCount: number;
  cdnrCount: number;
  expCount: number;

  b2bNetTaxable: number;
  b2clNetTaxable: number;
  b2csNetTaxable: number;
  cdnrNetTaxable: number;
  expNetTaxable: number;

  platformContributions: PlatformContribution[];
}

/**
 * Net Sales Engine
 *
 * Step 2 (Gross Reporting): Each row is passed through as-is.
 * - Sales rows (Shipment) → B2B / B2CS / B2CL / EXP (unchanged)
 * - Return rows (Refund)  → CDNR if buyer has a GSTIN (B2B return)
 *                         → CDNCS if buyer has no GSTIN (B2C return, credit note for B2C)
 *
 * We do NOT net returns against sales anymore.
 * GST law requires: report gross invoices in the supply period; credit notes in the refund period.
 * Netting causes under-reporting of B2B/B2CS values and produces incorrect period data
 * when the original sale and return fall in different months.
 */
export function processNetSales(rows: NormalizedInvoiceRow[]): NetSalesResult {
  const processedRows: NormalizedInvoiceRow[] = [];
  const platformMap = new Map<string, PlatformContribution>();

  let totalSalesTaxable = 0,
    totalSalesCgst = 0,
    totalSalesSgst = 0,
    totalSalesIgst = 0,
    totalSalesCess = 0;
  let totalReturnTaxable = 0,
    totalReturnCgst = 0,
    totalReturnSgst = 0,
    totalReturnIgst = 0,
    totalReturnCess = 0;

  for (const row of rows) {
    const isReturn =
      row.transactionType === "Return" || row.taxableValue < 0 || row.invoiceType === "CDNR";
    const absTaxable = Math.abs(row.taxableValue);
    const absCgst = Math.abs(row.cgstAmount);
    const absSgst = Math.abs(row.sgstAmount);
    const absIgst = Math.abs(row.igstAmount);
    const absCess = Math.abs(row.cessAmount);

    let updatedType = row.invoiceType;
    if (isReturn) {
      // B2B return (has buyer GSTIN) → CDNR
      // B2C return (no buyer GSTIN) → CDNCS (B2C Credit Note, goes in CDNUR in GSTR-1)
      if (row.buyerGstin && row.buyerGstin.trim().length === 15) {
        updatedType = "CDNR";
      } else {
        // B2C return — treat as CDNCS so it flows into CDNUR sheet in Excel output.
        // We do NOT reduce B2CS aggregate — credit notes are reported separately.
        updatedType = "CDNCS";
      }
    }

    const updatedRow: NormalizedInvoiceRow = {
      ...row,
      // Make all tax amounts positive for credit note rows — negative amounts in CDNR
      // cause double-subtraction in the generator (it already handles them as reductions).
      taxableValue: isReturn ? absTaxable : row.taxableValue,
      igstAmount: isReturn ? absIgst : row.igstAmount,
      cgstAmount: isReturn ? absCgst : row.cgstAmount,
      sgstAmount: isReturn ? absSgst : row.sgstAmount,
      cessAmount: isReturn ? absCess : row.cessAmount,
      totalValue: isReturn ? Math.abs(row.totalValue) : row.totalValue,
      invoiceType: updatedType,
      transactionType: isReturn ? "Return" : "Sales",
    };
    processedRows.push(updatedRow);

    // Track platform contributions
    const platformId = row.sourcePlatformId || "unknown";
    const platformName = row.sourcePlatformName || "Unknown Platform";
    const pContrib = platformMap.get(platformId) || {
      platformId,
      platformName,
      totalInvoices: 0,
      salesCount: 0,
      returnCount: 0,
      salesTaxable: 0,
      salesTax: 0,
      returnTaxable: 0,
      returnTax: 0,
      netTaxable: 0,
      netTax: 0,
    };

    pContrib.totalInvoices += 1;

    if (isReturn) {
      totalReturnTaxable += absTaxable;
      totalReturnCgst += absCgst;
      totalReturnSgst += absSgst;
      totalReturnIgst += absIgst;
      totalReturnCess += absCess;

      pContrib.returnCount += 1;
      pContrib.returnTaxable += absTaxable;
      pContrib.returnTax += absCgst + absSgst + absIgst + absCess;
    } else {
      totalSalesTaxable += absTaxable;
      totalSalesCgst += absCgst;
      totalSalesSgst += absSgst;
      totalSalesIgst += absIgst;
      totalSalesCess += absCess;

      pContrib.salesCount += 1;
      pContrib.salesTaxable += absTaxable;
      pContrib.salesTax += absCgst + absSgst + absIgst + absCess;
    }

    pContrib.netTaxable = round2(pContrib.salesTaxable - pContrib.returnTaxable);
    pContrib.netTax = round2(pContrib.salesTax - pContrib.returnTax);
    platformMap.set(platformId, pContrib);
  }

  totalSalesTaxable = round2(totalSalesTaxable);
  totalSalesCgst = round2(totalSalesCgst);
  totalSalesSgst = round2(totalSalesSgst);
  totalSalesIgst = round2(totalSalesIgst);
  totalSalesCess = round2(totalSalesCess);
  const totalSalesTax = round2(totalSalesCgst + totalSalesSgst + totalSalesIgst + totalSalesCess);

  totalReturnTaxable = round2(totalReturnTaxable);
  totalReturnCgst = round2(totalReturnCgst);
  totalReturnSgst = round2(totalReturnSgst);
  totalReturnIgst = round2(totalReturnIgst);
  totalReturnCess = round2(totalReturnCess);
  const totalReturnTax = round2(
    totalReturnCgst + totalReturnSgst + totalReturnIgst + totalReturnCess
  );

  const netTaxable = round2(totalSalesTaxable - totalReturnTaxable);
  const netCgst = round2(totalSalesCgst - totalReturnCgst);
  const netSgst = round2(totalSalesSgst - totalReturnSgst);
  const netIgst = round2(totalSalesIgst - totalReturnIgst);
  const netCess = round2(totalSalesCess - totalReturnCess);
  const netTax = round2(netCgst + netSgst + netIgst + netCess);
  const netGrandTotal = round2(netTaxable + netTax);

  // Category breakdown
  const b2bRows = processedRows.filter((r) => r.invoiceType === "B2B");
  const b2clRows = processedRows.filter((r) => r.invoiceType === "B2CL");
  const b2csRows = processedRows.filter((r) => r.invoiceType === "B2CS");
  const cdnrRows = processedRows.filter((r) => r.invoiceType === "CDNR");
  const expRows = processedRows.filter((r) => r.invoiceType === "EXP");

  return {
    processedRows,

    totalSalesTaxable,
    totalSalesCgst,
    totalSalesSgst,
    totalSalesIgst,
    totalSalesCess,
    totalSalesTax,

    totalReturnTaxable,
    totalReturnCgst,
    totalReturnSgst,
    totalReturnIgst,
    totalReturnCess,
    totalReturnTax,

    netTaxable,
    netCgst,
    netSgst,
    netIgst,
    netCess,
    netTax,
    netGrandTotal,

    b2bCount: b2bRows.length,
    b2clCount: b2clRows.length,
    b2csCount: b2csRows.length,
    cdnrCount: cdnrRows.length,
    expCount: expRows.length,

    b2bNetTaxable: round2(
      b2bRows.reduce(
        (s, r) => s + (r.transactionType === "Return" ? -r.taxableValue : r.taxableValue),
        0
      )
    ),
    b2clNetTaxable: round2(
      b2clRows.reduce(
        (s, r) => s + (r.transactionType === "Return" ? -r.taxableValue : r.taxableValue),
        0
      )
    ),
    b2csNetTaxable: round2(
      b2csRows.reduce(
        (s, r) => s + (r.transactionType === "Return" ? -r.taxableValue : r.taxableValue),
        0
      )
    ),
    cdnrNetTaxable: round2(cdnrRows.reduce((s, r) => s + Math.abs(r.taxableValue), 0)),
    expNetTaxable: round2(expRows.reduce((s, r) => s + r.taxableValue, 0)),

    platformContributions: Array.from(platformMap.values()),
  };
}
