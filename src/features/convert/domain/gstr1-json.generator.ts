/**
 * GSTR-1 JSON Generator
 * Writes the file the GST Returns Offline Tool (V3.2.4) writes, field for
 * field, so the portal takes it as the tool's own.
 * Tables: b2b, b2cl, b2cs, cdnr, cdnur, hsn, supeco, doc_issue
 */

import type {
  NormalizedInvoiceRow,
  ConversionSummary,
} from "@/features/convert/types/convert.types";
import { ensureTcsGstin, isValidGstin } from "@/features/convert/config/eco-registry";
import { isCdnurNote } from "@/features/convert/domain/gst-rules";
import {
  buildDocumentSeries,
  documentTypeSerial,
  type DocumentSeries,
} from "@/features/convert/domain/document-series";
import { buildHsnSummary, type HsnSummaryRow } from "@/features/convert/domain/hsn-summary";
import {
  excludeStockTransfers,
  isStockTransferRow,
} from "@/features/convert/domain/stock-transfer";

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * The GST Returns Offline Tool release this file is written as.
 *
 * The portal refuses a file stamped with an older release than the current
 * one — "download the latest version of Offline tool" — whatever its content.
 * This said GST3.1.6, four releases behind, and every upload was turned away.
 * Read from the official tool (gst.gov.in, V3.2.4, `formDataFormat`); when
 * GSTN ships a new release, this and the structures below are checked
 * against it again.
 */
export const OFFLINE_TOOL_VERSION = "GST3.2.4";

function rateOf(r: NormalizedInvoiceRow): number {
  return r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
}

interface JsonItem {
  num: number;
  itm_det: {
    txval: number;
    rt: number;
    iamt?: number;
    camt?: number;
    samt?: number;
    csamt: number;
  };
}

/**
 * An invoice's lines as the tool writes them: one item per rate, numbered
 * rate × 100 + 1 (5% is 501, 18% is 1801), with IGST for a supply to another
 * state and equal CGST and SGST within it.
 *
 * Every item used to be numbered 501, and an invoice with two rates went out
 * as two invoices of the same number — both of which the portal refuses.
 */
function itemsByRate(rows: NormalizedInvoiceRow[], interState: boolean): JsonItem[] {
  const byRate = new Map<number, { txval: number; tax: number; csamt: number }>();
  for (const row of rows) {
    const rt = rateOf(row);
    const bucket = byRate.get(rt) ?? { txval: 0, tax: 0, csamt: 0 };
    bucket.txval = r2(bucket.txval + Math.abs(row.taxableValue));
    bucket.tax = r2(
      bucket.tax + Math.abs(row.igstAmount) + Math.abs(row.cgstAmount) + Math.abs(row.sgstAmount)
    );
    bucket.csamt = r2(bucket.csamt + Math.abs(row.cessAmount));
    byRate.set(rt, bucket);
  }
  return [...byRate.entries()].map(([rt, b]) => {
    // CGST and SGST are each half the rate, and the tool writes them equal.
    const half = r2(b.tax / 2);
    return {
      num: Math.round(rt * 100) + 1,
      itm_det: interState
        ? { txval: b.txval, rt, iamt: b.tax, csamt: b.csamt }
        : { txval: b.txval, rt, camt: half, samt: half, csamt: b.csamt },
    };
  });
}

/** Rows of one document, keyed by its number. */
function groupByDocument(rows: NormalizedInvoiceRow[]): NormalizedInvoiceRow[][] {
  const docs = new Map<string, NormalizedInvoiceRow[]>();
  for (const row of rows) {
    const key = row.invoiceNumber.trim().toUpperCase();
    docs.set(key, [...(docs.get(key) ?? []), row]);
  }
  return [...docs.values()];
}

function documentValue(rows: NormalizedInvoiceRow[]): number {
  return r2(rows.reduce((sum, r) => sum + Math.abs(r.totalValue), 0));
}

// GSTN portal requires DD-MM-YYYY format, not YYYY-MM-DD.
function toGstnDate(isoDate: string): string {
  if (!isoDate) return "";
  // Already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(isoDate)) return isoDate;
  // Convert YYYY-MM-DD → DD-MM-YYYY
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return isoDate;
}

function deriveFilingPeriod(rows: NormalizedInvoiceRow[], period?: string): string {
  if (period && /^\d{6}$/.test(period.trim())) {
    return period.trim();
  }
  if (period && /^\d{2}-\d{4}$/.test(period.trim())) {
    return period.trim().replace("-", "");
  }
  // Fallback: derive from invoice dates e.g. "2026-06-22" -> "062026"
  for (const r of rows) {
    if (r.invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(r.invoiceDate)) {
      const [yyyy, mm] = r.invoiceDate.split("-");
      if (yyyy && mm) return `${mm}${yyyy}`;
    }
  }
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${mm}${yyyy}`;
}

export function generateGstr1Json(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  period: string,
  _summary: ConversionSummary,
  _watermark = false
): string {
  // Moving stock between the seller's own registrations is not an outward
  // supply, so it is held back from every table — not just from Table 4, which
  // was the only place this file used to check.
  const clean = rows.filter((r) => r.errors.length === 0);
  // Cancelled invoices and zero-value replacements used a number and supplied
  // nothing. Every table leaves them out; Table 13 counts them.
  const documentOnlyRows = clean.filter((r) => r.documentOnly);
  const validRows = excludeStockTransfers(
    clean.filter((r) => !r.documentOnly),
    gstin
  );
  const fp = deriveFilingPeriod(validRows, period);

  const supplierState = gstin ? gstin.substring(0, 2) : "";
  // The tool decides the tax heads the way the portal checks them: by the
  // place of supply against the supplier's state.
  const isInter = (pos: string) => Boolean(supplierState) && pos !== supplierState;

  /** Rows grouped by a key, in first-seen order. */
  const groupBy = (list: NormalizedInvoiceRow[], key: (r: NormalizedInvoiceRow) => string) => {
    const groups = new Map<string, NormalizedInvoiceRow[]>();
    for (const row of list) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
    return [...groups.entries()];
  };

  // --- B2B (Table 4) ---
  const b2b = groupBy(
    validRows.filter((r) => r.invoiceType === "B2B"),
    (r) => r.buyerGstin.toUpperCase()
  ).map(([ctin, list]) => ({
    ctin,
    inv: groupByDocument(list).map((doc) => {
      const head = doc[0]!;
      return {
        inum: head.invoiceNumber.trim(),
        idt: toGstnDate(head.invoiceDate),
        val: documentValue(doc),
        pos: head.placeOfSupply,
        rchrg: "N",
        inv_typ: "R",
        itms: itemsByRate(doc, isInter(head.placeOfSupply)),
      };
    }),
  }));

  // --- B2CL (Table 5) — inter-state by definition ---
  const b2cl = groupBy(
    validRows.filter((r) => r.invoiceType === "B2CL"),
    (r) => r.placeOfSupply
  ).map(([pos, list]) => ({
    pos,
    inv: groupByDocument(list).map((doc) => ({
      inum: doc[0]!.invoiceNumber.trim(),
      idt: toGstnDate(doc[0]!.invoiceDate),
      val: documentValue(doc),
      itms: itemsByRate(doc, true),
    })),
  }));

  // --- B2CS ---
  const b2csRows = validRows.filter((r) => r.invoiceType === "B2CS" || r.invoiceType === "CDNCS");
  // One line per place of supply and rate — not per marketplace. A B2CS line
  // carries no operator field any more (the operator is Table 14's business),
  // so splitting by it gave the portal two lines with the same state and rate
  // whenever a seller sold in one state through two marketplaces. The filed
  // returns carry each state once; the Excel of the same return already did.
  const b2csMap = new Map<
    string,
    {
      txval: number;
      iamt: number;
      camt: number;
      samt: number;
      csamt: number;
      rt: number;
      pos: string;
    }
  >();
  for (const row of b2csRows) {
    const rt = r2(row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate);
    const key = `${row.placeOfSupply}|${rt}`;
    if (!b2csMap.has(key)) {
      b2csMap.set(key, {
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
        rt,
        pos: row.placeOfSupply,
      });
    }
    const sign = row.invoiceType === "CDNCS" ? -1 : 1;
    const bucket = b2csMap.get(key)!;
    bucket.txval = r2(bucket.txval + Math.abs(row.taxableValue) * sign);
    bucket.iamt = r2(bucket.iamt + Math.abs(row.igstAmount) * sign);
    bucket.camt = r2(bucket.camt + Math.abs(row.cgstAmount) * sign);
    bucket.samt = r2(bucket.samt + Math.abs(row.sgstAmount) * sign);
    bucket.csamt = r2(bucket.csamt + Math.abs(row.cessAmount) * sign);
  }
  const b2cs = Array.from(b2csMap.values())
    .filter((val) => Math.abs(val.txval) > 0.001)
    .map((val) => {
      const inter = isInter(val.pos);
      // Equal halves, as the tool writes them: summed line by line, CGST and
      // SGST could drift a paisa apart.
      const half = r2((val.iamt + val.camt + val.samt) / 2);
      return {
        sply_ty: inter ? "INTER" : "INTRA",
        rt: val.rt,
        typ: "OE",
        pos: val.pos,
        txval: val.txval,
        ...(inter
          ? { iamt: r2(val.iamt + val.camt + val.samt), csamt: val.csamt }
          : { camt: half, samt: half, csamt: val.csamt }),
      };
    });

  // --- CDNR (B2B Credit Notes) ---
  // Since the 2020 delinking a note is reported in its own right: place of
  // supply, reverse charge and supply type, as an invoice is. The reason and
  // pre-GST fields this wrote ("rsn", "p_gst") belong to the old schema, and
  // the note had no place of supply at all; the tool writes neither and the
  // portal refuses the file for both.
  const cdnr = groupBy(
    validRows.filter((r) => r.invoiceType === "CDNR" && r.buyerGstin.length === 15),
    (r) => r.buyerGstin.toUpperCase()
  ).map(([ctin, list]) => ({
    ctin,
    nt: groupByDocument(list).map((doc) => {
      const head = doc[0]!;
      return {
        ntty: head.isDebitNote ? "D" : "C",
        nt_num: head.invoiceNumber.trim(),
        nt_dt: toGstnDate(head.invoiceDate),
        val: documentValue(doc),
        pos: head.placeOfSupply,
        rchrg: "N",
        inv_typ: "R",
        itms: itemsByRate(doc, isInter(head.placeOfSupply)),
      };
    }),
  }));

  // --- CDNUR (B2C Large & Export Credit Notes only) ---
  // In GST Law, small B2C marketplace credit notes (CDNCS) are netted inside Table 7 (b2cs).
  // Only large B2C notes or Export credit notes belong in Table 9B CDNUR. The
  // limit moved from ₹2.5L to ₹1L on 1 Aug 2024 and applies by note date.
  const cdnurRows = validRows.filter(
    (r) =>
      isCdnurNote(r) ||
      (r.invoiceType === "EXP" && (r.transactionType === "Return" || r.taxableValue < 0))
  );
  // The tool knows three kinds of unregistered note — a large B2C sale, and an
  // export with or without payment of tax. "OE" is a Table 7 type; written
  // here, it named none of them.
  const cdnur = groupByDocument(cdnurRows).map((doc) => {
    const head = doc[0]!;
    const typ =
      head.invoiceType === "EXP" ? (head.exportType === "WPAY" ? "EXPWP" : "EXPWOP") : "B2CL";
    return {
      typ,
      ntty: head.isDebitNote ? "D" : "C",
      nt_num: head.invoiceNumber.trim(),
      nt_dt: toGstnDate(head.invoiceDate),
      val: documentValue(doc),
      ...(typ === "B2CL" ? { pos: head.placeOfSupply } : {}),
      itms: itemsByRate(doc, typ !== "B2CL" || isInter(head.placeOfSupply)),
    };
  });

  // --- HSN Summary (Table 12) ---
  // Built by the shared domain helper so the JSON and the Excel of one return
  // cannot disagree. This file wrote row.hsnCode straight through: a blank
  // code — which is what a row carries when nothing classified it — became an
  // hsn_sc of "", and the portal refuses the file. "000000" and un-padded
  // 4-digit headings went through the same way.
  const hsnSummary = buildHsnSummary(validRows);

  const toHsnArr = (list: HsnSummaryRow[]) =>
    list.map((v, idx) => ({
      num: idx + 1,
      hsn_sc: v.hsnCode,
      uqc: v.uqc,
      qty: Math.max(0, v.quantity),
      rt: v.rate,
      txval: Math.max(0, v.taxableValue),
      iamt: Math.max(0, v.igstAmount),
      samt: Math.max(0, v.sgstAmount),
      camt: Math.max(0, v.cgstAmount),
      csamt: Math.max(0, v.cessAmount),
    }));

  const hsn = {
    ...(hsnSummary.b2b.length > 0 ? { hsn_b2b: toHsnArr(hsnSummary.b2b) } : {}),
    ...(hsnSummary.b2c.length > 0 ? { hsn_b2c: toHsnArr(hsnSummary.b2c) } : {}),
  };

  // --- Document Summary (Table 13) ---
  // Table 13 reports serial ranges of tax invoices and credit notes issued.
  // Marketplace sub-orders or numbers with underscores (e.g. Meesho sub_order_num) are excluded.
  // Excluding every Meesho row used to stand here. That was a blunt proxy for
  // the real distinction, and it cut the wrong way twice: Amazon's MTR carries
  // the invoice numbers the seller actually issued — the filed returns report
  // IN-113 to IN-123 — while Meesho's TCS export carries order references. And
  // when Meesho's tax invoice details sheet *is* uploaded, its real numbers
  // form a genuine series that should be reported. Whether a number belongs to
  // a series is the test; which marketplace it came from is not.
  //
  // A stock transfer is reported as a supply, but its document is not one of
  // the seller's own: Amazon numbers these "FBA15M3NST8K" from its shipment
  // ids, and the transfer book "LKO1-T-" is not the "LKO1-" invoice book.
  // Table 13 is an account of the serial numbers the seller issued, which is
  // why the filed returns list the invoice books and leave these out.
  const isEligibleDocInvoice = (r: NormalizedInvoiceRow): boolean => {
    if (isStockTransferRow(r, gstin)) return false;
    const inv = r.invoiceNumber.trim();
    return /^[a-zA-Z0-9\-\/]{1,16}$/.test(inv);
  };

  // Built by the shared domain helper so the JSON and the Excel of one return
  // cannot disagree. This file grew its own prefix-grouping with no test of
  // whether a "series" was one, and enumerated every marketplace order
  // reference as a separate entry.
  const series = buildDocumentSeries(
    [...validRows, ...documentOnlyRows].filter(isEligibleDocInvoice)
  );

  const docSeries = (docTyp: DocumentSeries["documentType"]) => {
    const mine = series.filter((s) => s.documentType === docTyp);
    if (mine.length === 0) return null;
    return {
      doc_num: documentTypeSerial(docTyp),
      doc_typ: docTyp,
      docs: mine.map((s, index) => ({
        num: index + 1,
        from: s.from,
        to: s.to,
        totnum: s.totalNumber,
        cancel: s.cancelled,
        net_issue: s.totalNumber - s.cancelled,
      })),
    };
  };

  const docDet = [
    docSeries("Invoices for outward supply"),
    docSeries("Debit Note"),
    docSeries("Credit Note"),
  ].filter((d): d is NonNullable<typeof d> => d !== null);

  const docIssue = docDet.length > 0 ? { doc_det: docDet } : undefined;

  // --- Table 14(a): supplies made through an e-commerce operator ---
  //
  // Every supply the operator collected tax on belongs here, not only the ones
  // to unregistered buyers: the operator collects under section 52 on the
  // marketplace's whole turnover for the seller. This block used to take B2CS
  // and CDNCS alone, which left a month's B2B sales through the marketplace
  // out of Table 14 while the Excel of the same return counted them.
  const ecoMap = new Map<
    string,
    { ecoName: string; txval: number; iamt: number; camt: number; samt: number; csamt: number }
  >();
  for (const row of validRows) {
    if (!row.ecoGstin || row.sourcePlatformId === "offline") continue;

    // An operator value that is not a GSTIN at all is left out of Table 14
    // rather than replaced. The replacement this used was another operator's
    // number with the wrong check digit — Meesho's supplies filed under
    // Amazon's PAN.
    const etin = ensureTcsGstin(row.ecoGstin.trim().toUpperCase());
    if (!isValidGstin(etin)) continue;

    if (!ecoMap.has(etin)) {
      ecoMap.set(etin, {
        ecoName: row.ecoName ?? "",
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
      });
    }
    // A credit note reduces what the operator collected on, whether the buyer
    // was registered or not.
    const sign = row.invoiceType === "CDNCS" || row.invoiceType === "CDNR" ? -1 : 1;
    const b = ecoMap.get(etin)!;
    b.txval = r2(b.txval + Math.abs(row.taxableValue) * sign);
    b.iamt = r2(b.iamt + Math.abs(row.igstAmount) * sign);
    b.camt = r2(b.camt + Math.abs(row.cgstAmount) * sign);
    b.samt = r2(b.samt + Math.abs(row.sgstAmount) * sign);
    b.csamt = r2(b.csamt + Math.abs(row.cessAmount) * sign);
  }
  const supeco = Array.from(ecoMap.entries()).map(([etin, val]) => ({
    etin,
    suppval: val.txval,
    igst: val.iamt,
    cgst: val.camt,
    sgst: val.samt,
    cess: val.csamt,
  }));

  const gstr1 = {
    gstin,
    fp,
    version: OFFLINE_TOOL_VERSION,
    hash: "hash",
    b2b: b2b.length > 0 ? b2b : undefined,
    b2cl: b2cl.length > 0 ? b2cl : undefined,
    b2cs: b2cs.length > 0 ? b2cs : undefined,
    cdnr: cdnr.length > 0 ? cdnr : undefined,
    cdnur: cdnur.length > 0 ? cdnur : undefined,
    supeco: supeco.length > 0 ? { clttx: supeco } : undefined,
    hsn,
    doc_issue: docIssue,
  };

  return JSON.stringify(gstr1, null, 2);
}
