import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * The slice of a generated row this comparison actually reads.
 *
 * Declared as a Pick so the compiler proves the list is complete. It exists
 * because the comparison runs in a Server Action: shipping ~3,000 whole rows —
 * descriptions, source file names, review notes — up to the server made the
 * request several times larger than it needed to be, for fields nothing here
 * looks at.
 */
export type ComparableRow = Pick<
  NormalizedInvoiceRow,
  | "invoiceNumber"
  | "invoiceType"
  | "transactionType"
  | "errors"
  | "placeOfSupply"
  | "buyerGstin"
  | "taxableValue"
  | "totalValue"
  | "igstAmount"
  | "cgstAmount"
  | "sgstAmount"
  | "cessAmount"
  | "igstRate"
  | "cgstRate"
  | "sgstRate"
>;

/** Narrows a full row to what the comparison needs, for the wire. */
export function toComparableRow(row: NormalizedInvoiceRow): ComparableRow {
  return {
    invoiceNumber: row.invoiceNumber,
    invoiceType: row.invoiceType,
    transactionType: row.transactionType,
    errors: row.errors,
    placeOfSupply: row.placeOfSupply,
    buyerGstin: row.buyerGstin,
    taxableValue: row.taxableValue,
    totalValue: row.totalValue,
    igstAmount: row.igstAmount,
    cgstAmount: row.cgstAmount,
    sgstAmount: row.sgstAmount,
    cessAmount: row.cessAmount,
    igstRate: row.igstRate,
    cgstRate: row.cgstRate,
    sgstRate: row.sgstRate,
  };
}
import type { ParsedGstr1Template } from "./gstr1-template.parser";

// ── Comparison Result Types ───────────────────────────────────────────────────

export type ComparisonStatus = "matched" | "mismatch" | "only_in_ours" | "only_in_ref";

export interface InvoiceComparisonRow {
  invoiceNumber: string;
  status: ComparisonStatus;
  section: "B2B" | "B2CS" | "B2CL" | "CDNR" | "CDNUR";
  // Our values
  ourTaxableValue: number | null;
  ourTaxAmount: number | null;
  ourRate: number | null;
  ourPlaceOfSupply: string | null;
  ourBuyerGstin: string | null;
  // Reference values (from uploaded template)
  refTaxableValue: number | null;
  refTaxAmount: number | null;
  refRate: number | null;
  refPlaceOfSupply: string | null;
  refBuyerGstin: string | null;
  // Differences
  diffTaxable: number | null;
  diffTax: number | null;
  notes: string[];
}

export interface B2csSummaryRow {
  placeOfSupply: string;
  rate: number;
  status: ComparisonStatus;
  ourTaxableValue: number;
  refTaxableValue: number;
  diffTaxable: number;
}

export interface Gstr1ComparisonResult {
  referenceSourceType: string;
  totalOurInvoices: number;
  totalRefInvoices: number;
  matchedCount: number;
  mismatchCount: number;
  onlyInOursCount: number;
  onlyInRefCount: number;
  b2bRows: InvoiceComparisonRow[];
  b2clRows: InvoiceComparisonRow[];
  b2csSummary: B2csSummaryRow[];
  cdnrRows: InvoiceComparisonRow[];
  cdnurRows: InvoiceComparisonRow[];
  b2csTotalOur: number;
  b2csTotalRef: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOLERANCE = 2; // ₹2 tolerance for rounding differences

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function totalTax(row: ComparableRow): number {
  return r2(row.igstAmount + row.cgstAmount + row.sgstAmount);
}

function gstRate(row: ComparableRow): number {
  return row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate;
}

function statusFor(diffTaxable: number, diffTax: number): ComparisonStatus {
  return Math.abs(diffTaxable) <= TOLERANCE && Math.abs(diffTax) <= TOLERANCE
    ? "matched"
    : "mismatch";
}

// ── Main Comparator ───────────────────────────────────────────────────────────

/**
 * Gstr1Comparator — compares our generated NormalizedInvoiceRow[]
 * against a ParsedGstr1Template (from Amazon's GSTR-1 or Govt template).
 *
 * Comparison strategy:
 *   B2B:   match by invoiceNumber (case-insensitive, trimmed)
 *   CDNR:  match by noteNumber
 *   B2CL:  match by invoiceNumber
 *   B2CS:  aggregate by (placeOfSupply + rate) and compare totals
 *   CDNUR: match by noteNumber
 *
 * Tolerance: ₹2 rounding difference is treated as MATCHED.
 */
export class Gstr1Comparator {
  static compare(ourRows: ComparableRow[], ref: ParsedGstr1Template): Gstr1ComparisonResult {
    const result: Gstr1ComparisonResult = {
      referenceSourceType: ref.sourceType,
      totalOurInvoices: 0,
      totalRefInvoices: 0,
      matchedCount: 0,
      mismatchCount: 0,
      onlyInOursCount: 0,
      onlyInRefCount: 0,
      b2bRows: [],
      b2clRows: [],
      b2csSummary: [],
      cdnrRows: [],
      cdnurRows: [],
      b2csTotalOur: 0,
      b2csTotalRef: 0,
    };

    // ── Split our rows by section ─────────────────────────────────────────
    const ourB2bRaw = ourRows.filter(
      (r) => r.invoiceType === "B2B" && r.transactionType === "Sales" && r.errors.length === 0
    );
    // Aggregate B2B rows by invoice number so multi-line invoices (like BLR7-T-7) match ref 1:1
    const aggregatedB2bMap = new Map<string, ComparableRow>();
    for (const r of ourB2bRaw) {
      const key = r.invoiceNumber.trim().toLowerCase();
      if (!aggregatedB2bMap.has(key)) {
        aggregatedB2bMap.set(key, { ...r });
      } else {
        const existing = aggregatedB2bMap.get(key)!;
        existing.taxableValue = r2(existing.taxableValue + r.taxableValue);
        existing.totalValue = r2(existing.totalValue + r.totalValue);
        existing.igstAmount = r2(existing.igstAmount + r.igstAmount);
        existing.cgstAmount = r2(existing.cgstAmount + r.cgstAmount);
        existing.sgstAmount = r2(existing.sgstAmount + r.sgstAmount);
        existing.cessAmount = r2(existing.cessAmount + r.cessAmount);
      }
    }
    const ourB2b = Array.from(aggregatedB2bMap.values());

    const ourCdnr = ourRows.filter((r) => r.invoiceType === "CDNR" && r.errors.length === 0);
    const ourB2cl = ourRows.filter(
      (r) => r.invoiceType === "B2CL" && r.transactionType === "Sales" && r.errors.length === 0
    );

    result.totalOurInvoices = ourB2b.length + ourCdnr.length + ourB2cl.length;
    result.totalRefInvoices =
      ref.b2b.length + ref.cdnr.length + ref.b2cs.length + ref.b2cl.length + ref.cdnur.length;

    // ── B2B Comparison ────────────────────────────────────────────────────
    // Match by full invoice number or 16-char prefix (for truncated order IDs)
    const refB2bProcessed = new Set<string>();

    for (const ours of ourB2b) {
      const ourKey = ours.invoiceNumber.trim().toLowerCase();
      // Try exact match first, then 16-char prefix match
      let refRow = ref.b2b.find((r) => r.invoiceNumber.trim().toLowerCase() === ourKey);
      if (!refRow && ourKey.length >= 16) {
        const prefix = ourKey.substring(0, 16);
        refRow = ref.b2b.find(
          (r) => r.invoiceNumber.trim().toLowerCase().substring(0, 16) === prefix
        );
      }

      if (refRow) {
        refB2bProcessed.add(refRow.invoiceNumber.trim().toLowerCase());
        const ourTax = totalTax(ours);
        const refTax = refRow.rate > 0 ? r2((refRow.taxableValue * refRow.rate) / 100) : ourTax;
        const diffTaxable = r2(ours.taxableValue - refRow.taxableValue);
        const diffTax = r2(ourTax - refTax);
        const status = statusFor(diffTaxable, diffTax);
        const notes: string[] = [];
        if (Math.abs(diffTaxable) > TOLERANCE) notes.push(`Taxable diff ₹${Math.abs(diffTaxable)}`);
        if (Math.abs(diffTax) > TOLERANCE) notes.push(`Tax diff ₹${Math.abs(diffTax)}`);
        if (ours.placeOfSupply !== refRow.placeOfSupply)
          notes.push(`POS: ours ${ours.placeOfSupply} vs ref ${refRow.placeOfSupply}`);

        result.b2bRows.push({
          invoiceNumber: ours.invoiceNumber,
          status,
          section: "B2B",
          ourTaxableValue: ours.taxableValue,
          ourTaxAmount: ourTax,
          ourRate: gstRate(ours),
          ourPlaceOfSupply: ours.placeOfSupply,
          ourBuyerGstin: ours.buyerGstin,
          refTaxableValue: refRow.taxableValue,
          refTaxAmount: refTax,
          refRate: refRow.rate,
          refPlaceOfSupply: refRow.placeOfSupply,
          refBuyerGstin: refRow.buyerGstin,
          diffTaxable,
          diffTax,
          notes,
        });

        if (status === "matched") result.matchedCount++;
        else result.mismatchCount++;
      } else {
        result.onlyInOursCount++;
        result.b2bRows.push({
          invoiceNumber: ours.invoiceNumber,
          status: "only_in_ours",
          section: "B2B",
          ourTaxableValue: ours.taxableValue,
          ourTaxAmount: totalTax(ours),
          ourRate: gstRate(ours),
          ourPlaceOfSupply: ours.placeOfSupply,
          ourBuyerGstin: ours.buyerGstin,
          refTaxableValue: null,
          refTaxAmount: null,
          refRate: null,
          refPlaceOfSupply: null,
          refBuyerGstin: null,
          diffTaxable: null,
          diffTax: null,
          notes: ["Not found in reference GSTR-1"],
        });
      }
    }

    // Remaining reference B2B rows not matched
    for (const refRow of ref.b2b) {
      if (!refB2bProcessed.has(refRow.invoiceNumber.trim().toLowerCase())) {
        result.onlyInRefCount++;
        result.b2bRows.push({
          invoiceNumber: refRow.invoiceNumber,
          status: "only_in_ref",
          section: "B2B",
          ourTaxableValue: null,
          ourTaxAmount: null,
          ourRate: null,
          ourPlaceOfSupply: null,
          ourBuyerGstin: null,
          refTaxableValue: refRow.taxableValue,
          refTaxAmount: r2((refRow.taxableValue * refRow.rate) / 100),
          refRate: refRow.rate,
          refPlaceOfSupply: refRow.placeOfSupply,
          refBuyerGstin: refRow.buyerGstin,
          diffTaxable: null,
          diffTax: null,
          notes: ["In reference GSTR-1 but not in our output"],
        });
      }
    }

    // ── B2CL Comparison ───────────────────────────────────────────────────
    const refB2clMap = new Map(ref.b2cl.map((r) => [r.invoiceNumber.toLowerCase(), r]));
    const ourB2clMap = new Map(ourB2cl.map((r) => [r.invoiceNumber.toLowerCase(), r]));

    for (const key of new Set([...refB2clMap.keys(), ...ourB2clMap.keys()])) {
      const ours = ourB2clMap.get(key);
      const refRow = refB2clMap.get(key);

      if (ours && refRow) {
        const ourTax = totalTax(ours);
        const refTax = r2(refRow.taxableValue * (refRow.rate / 100));
        const diffTaxable = r2(ours.taxableValue - refRow.taxableValue);
        const diffTax = r2(ourTax - refTax);
        const status = statusFor(diffTaxable, diffTax);
        result.b2clRows.push({
          invoiceNumber: ours.invoiceNumber,
          status,
          section: "B2CL",
          ourTaxableValue: ours.taxableValue,
          ourTaxAmount: ourTax,
          ourRate: gstRate(ours),
          ourPlaceOfSupply: ours.placeOfSupply,
          ourBuyerGstin: null,
          refTaxableValue: refRow.taxableValue,
          refTaxAmount: refTax,
          refRate: refRow.rate,
          refPlaceOfSupply: refRow.placeOfSupply,
          refBuyerGstin: null,
          diffTaxable,
          diffTax,
          notes: [],
        });
        if (status === "matched") result.matchedCount++;
        else result.mismatchCount++;
      } else if (ours) {
        result.onlyInOursCount++;
        result.b2clRows.push({
          invoiceNumber: ours.invoiceNumber,
          status: "only_in_ours",
          section: "B2CL",
          ourTaxableValue: ours.taxableValue,
          ourTaxAmount: totalTax(ours),
          ourRate: gstRate(ours),
          ourPlaceOfSupply: ours.placeOfSupply,
          ourBuyerGstin: null,
          refTaxableValue: null,
          refTaxAmount: null,
          refRate: null,
          refPlaceOfSupply: null,
          refBuyerGstin: null,
          diffTaxable: null,
          diffTax: null,
          notes: ["Not in reference"],
        });
      } else if (refRow) {
        result.onlyInRefCount++;
        result.b2clRows.push({
          invoiceNumber: refRow.invoiceNumber,
          status: "only_in_ref",
          section: "B2CL",
          ourTaxableValue: null,
          ourTaxAmount: null,
          ourRate: null,
          ourPlaceOfSupply: null,
          ourBuyerGstin: null,
          refTaxableValue: refRow.taxableValue,
          refTaxAmount: r2((refRow.taxableValue * refRow.rate) / 100),
          refRate: refRow.rate,
          refPlaceOfSupply: refRow.placeOfSupply,
          refBuyerGstin: null,
          diffTaxable: null,
          diffTax: null,
          notes: ["In reference but not in our output"],
        });
      }
    }

    // ── B2CS Comparison (aggregate by POS + rate, netting off B2C returns) ──
    const ourB2cRows = ourRows.filter(
      (r) => (r.invoiceType === "B2CS" || r.invoiceType === "CDNCS") && r.errors.length === 0
    );
    const ourB2csMap = new Map<string, number>();
    for (const r of ourB2cRows) {
      const k = `${r.placeOfSupply}|${gstRate(r)}`;
      const sign = r.invoiceType === "CDNCS" ? -1 : 1;
      const val = r2(Math.abs(r.taxableValue) * sign);
      ourB2csMap.set(k, r2((ourB2csMap.get(k) ?? 0) + val));
      result.b2csTotalOur = r2(result.b2csTotalOur + val);
    }

    const refB2csMap = new Map<string, number>();
    for (const r of ref.b2cs) {
      const k = `${r.placeOfSupply}|${r.rate}`;
      refB2csMap.set(k, r2((refB2csMap.get(k) ?? 0) + r.taxableValue));
      result.b2csTotalRef = r2(result.b2csTotalRef + r.taxableValue);
    }

    for (const key of new Set([...ourB2csMap.keys(), ...refB2csMap.keys()])) {
      const [pos, rateStr] = key.split("|");
      const ourVal = ourB2csMap.get(key) ?? 0;
      const refVal = refB2csMap.get(key) ?? 0;
      const diff = r2(ourVal - refVal);
      const status: ComparisonStatus =
        ourVal === 0 && refVal !== 0
          ? "only_in_ref"
          : refVal === 0 && ourVal !== 0
            ? "only_in_ours"
            : Math.abs(diff) <= TOLERANCE
              ? "matched"
              : "mismatch";
      if (status === "matched") result.matchedCount++;
      else if (status === "mismatch") result.mismatchCount++;
      else if (status === "only_in_ours") result.onlyInOursCount++;
      else result.onlyInRefCount++;

      result.b2csSummary.push({
        placeOfSupply: pos ?? "",
        rate: parseFloat(rateStr ?? "0"),
        status,
        ourTaxableValue: ourVal,
        refTaxableValue: refVal,
        diffTaxable: diff,
      });
    }

    // ── CDNR Comparison ───────────────────────────────────────────────────
    const refCdnrMap = new Map(ref.cdnr.map((r) => [r.noteNumber.toLowerCase(), r]));
    const ourCdnrMap = new Map(ourCdnr.map((r) => [r.invoiceNumber.toLowerCase(), r]));

    for (const key of new Set([...refCdnrMap.keys(), ...ourCdnrMap.keys()])) {
      const ours = ourCdnrMap.get(key);
      const refRow = refCdnrMap.get(key);
      if (ours && refRow) {
        const ourTax = Math.abs(totalTax(ours));
        const refTax = r2(refRow.taxableValue * (refRow.rate / 100));
        const diffTaxable = r2(Math.abs(ours.taxableValue) - refRow.taxableValue);
        const diffTax = r2(ourTax - refTax);
        const status = statusFor(diffTaxable, diffTax);
        result.cdnrRows.push({
          invoiceNumber: ours.invoiceNumber,
          status,
          section: "CDNR",
          ourTaxableValue: ours.taxableValue,
          ourTaxAmount: ourTax,
          ourRate: gstRate(ours),
          ourPlaceOfSupply: ours.placeOfSupply,
          ourBuyerGstin: ours.buyerGstin,
          refTaxableValue: refRow.taxableValue,
          refTaxAmount: refTax,
          refRate: refRow.rate,
          refPlaceOfSupply: refRow.placeOfSupply,
          refBuyerGstin: refRow.buyerGstin,
          diffTaxable,
          diffTax,
          notes: [],
        });
        if (status === "matched") result.matchedCount++;
        else result.mismatchCount++;
      } else if (ours) {
        result.onlyInOursCount++;
        result.cdnrRows.push({
          invoiceNumber: ours.invoiceNumber,
          status: "only_in_ours",
          section: "CDNR",
          ourTaxableValue: ours.taxableValue,
          ourTaxAmount: totalTax(ours),
          ourRate: gstRate(ours),
          ourPlaceOfSupply: ours.placeOfSupply,
          ourBuyerGstin: ours.buyerGstin,
          refTaxableValue: null,
          refTaxAmount: null,
          refRate: null,
          refPlaceOfSupply: null,
          refBuyerGstin: null,
          diffTaxable: null,
          diffTax: null,
          notes: [],
        });
      } else if (refRow) {
        result.onlyInRefCount++;
        result.cdnrRows.push({
          invoiceNumber: refRow.noteNumber,
          status: "only_in_ref",
          section: "CDNR",
          ourTaxableValue: null,
          ourTaxAmount: null,
          ourRate: null,
          ourPlaceOfSupply: null,
          ourBuyerGstin: null,
          refTaxableValue: refRow.taxableValue,
          refTaxAmount: r2((refRow.taxableValue * refRow.rate) / 100),
          refRate: refRow.rate,
          refPlaceOfSupply: refRow.placeOfSupply,
          refBuyerGstin: refRow.buyerGstin,
          diffTaxable: null,
          diffTax: null,
          notes: [],
        });
      }
    }

    // ── CDNUR Comparison (ref-only; our system maps B2C credit notes to CDNR) ─
    // Any CDNUR note from the reference that wasn't already matched via CDNR is "only_in_ref"
    const ourCdnrNoteKeys = new Set(ourCdnr.map((r) => r.invoiceNumber.toLowerCase()));
    for (const refRow of ref.cdnur) {
      const key = refRow.noteNumber.toLowerCase();
      if (!ourCdnrNoteKeys.has(key)) {
        result.onlyInRefCount++;
        result.cdnurRows.push({
          invoiceNumber: refRow.noteNumber,
          status: "only_in_ref",
          section: "CDNUR",
          ourTaxableValue: null,
          ourTaxAmount: null,
          ourRate: null,
          ourPlaceOfSupply: null,
          ourBuyerGstin: null,
          refTaxableValue: refRow.taxableValue,
          refTaxAmount: r2((refRow.taxableValue * refRow.rate) / 100),
          refRate: refRow.rate,
          refPlaceOfSupply: refRow.placeOfSupply,
          refBuyerGstin: null,
          diffTaxable: null,
          diffTax: null,
          notes: ["B2C credit note in reference — not found in our output"],
        });
      }
    }

    return result;
  }
}
