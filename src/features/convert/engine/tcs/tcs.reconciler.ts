import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

export interface TcsStateComparison {
  stateCode: string;
  stateName: string;
  gstr1Taxable: number;
  gstr1Tax: number;
  portalTaxable: number;
  portalTax: number;
  diffTaxable: number;
  diffTax: number;
  status: "MATCHED" | "MISMATCH" | "ONLY_IN_GSTR1" | "ONLY_IN_PORTAL";
}

export interface TcsReconciliationResult {
  isReconciled: boolean;
  totalGstr1Taxable: number;
  totalPortalTaxable: number;
  totalDiffTaxable: number;
  stateComparisons: TcsStateComparison[];
  reconciledRows: NormalizedInvoiceRow[];
}

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * TCS Reconciliation Engine — Compares GSTR-1 Net Sales against official GST Portal TCS exports state-wise.
 */
export class TcsReconciler {
  static reconcile(
    gstr1Rows: NormalizedInvoiceRow[],
    portalTcsRows: Record<string, unknown>[]
  ): TcsReconciliationResult {
    const gstr1StateMap = new Map<string, { taxable: number; tax: number }>();

    for (const r of gstr1Rows) {
      if (r.errors.length > 0) continue;
      const pos = r.placeOfSupply || "99";
      const sign = r.transactionType === "Return" ? -1 : 1;
      const cur = gstr1StateMap.get(pos) || { taxable: 0, tax: 0 };
      cur.taxable = r2(cur.taxable + sign * r.taxableValue);
      cur.tax = r2(cur.tax + sign * (r.cgstAmount + r.sgstAmount + r.igstAmount));
      gstr1StateMap.set(pos, cur);
    }

    const portalStateMap = new Map<string, { taxable: number; tax: number }>();
    for (const pRow of portalTcsRows) {
      const pos = String(
        pRow["POS"] || pRow["State Code"] || pRow["place_of_supply"] || "99"
      ).slice(0, 2);
      const taxable = Number(
        pRow["Taxable Value"] || pRow["Net Value"] || pRow["taxable_value"] || 0
      );
      const tax = Number(pRow["Total Tax"] || pRow["TCS Amount"] || pRow["total_tax"] || 0);
      const cur = portalStateMap.get(pos) || { taxable: 0, tax: 0 };
      cur.taxable = r2(cur.taxable + taxable);
      cur.tax = r2(cur.tax + tax);
      portalStateMap.set(pos, cur);
    }

    const allStates = new Set([...gstr1StateMap.keys(), ...portalStateMap.keys()]);
    const stateComparisons: TcsStateComparison[] = [];
    let isReconciled = true;
    let totalGstr1Taxable = 0;
    let totalPortalTaxable = 0;

    for (const stateCode of allStates) {
      const g = gstr1StateMap.get(stateCode) || { taxable: 0, tax: 0 };
      const p = portalStateMap.get(stateCode) || { taxable: 0, tax: 0 };

      totalGstr1Taxable += g.taxable;
      totalPortalTaxable += p.taxable;

      const diffTaxable = r2(g.taxable - p.taxable);
      const diffTax = r2(g.tax - p.tax);

      let status: TcsStateComparison["status"] = "MATCHED";
      if (Math.abs(diffTaxable) > 5) {
        status = "MISMATCH";
        isReconciled = false;
      }

      stateComparisons.push({
        stateCode,
        stateName: `State ${stateCode}`,
        gstr1Taxable: g.taxable,
        gstr1Tax: g.tax,
        portalTaxable: p.taxable,
        portalTax: p.tax,
        diffTaxable,
        diffTax,
        status,
      });
    }

    return {
      isReconciled,
      totalGstr1Taxable: r2(totalGstr1Taxable),
      totalPortalTaxable: r2(totalPortalTaxable),
      totalDiffTaxable: r2(totalGstr1Taxable - totalPortalTaxable),
      stateComparisons,
      reconciledRows: gstr1Rows,
    };
  }
}
