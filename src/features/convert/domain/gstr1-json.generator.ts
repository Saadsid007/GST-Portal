/**
 * GSTR-1 JSON Generator
 * Produces GSTN Offline Tool v3.0+ compatible JSON
 * Tables: b2b, b2cl, b2cs, cdnr, exp, hsn, supeco, doc_issue
 */

import type {
  NormalizedInvoiceRow,
  ConversionSummary,
} from "@/features/convert/types/convert.types";
import { ensureTcsGstin } from "@/features/convert/config/eco-registry";
import { isCdnurNote } from "@/features/convert/domain/gst-rules";
import {
  buildDocumentSeries,
  type DocumentSeries,
} from "@/features/convert/domain/document-series";
import { buildHsnSummary, type HsnSummaryRow } from "@/features/convert/domain/hsn-summary";

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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

function isStockTransferRow(r: NormalizedInvoiceRow, gstin: string): boolean {
  if (r.sourcePlatformId === "amazon_stock_transfer") return true;
  if (
    (r.transactionType as string) === "FC_TRANSFER" ||
    (r.transactionType as string) === "FC_REMOVAL"
  )
    return true;
  if (/-(T|D)-\d+$/i.test(r.invoiceNumber) || r.invoiceNumber.startsWith("AFT-")) return true;
  if (r.buyerGstin && gstin && r.buyerGstin.length >= 12 && gstin.length >= 12) {
    const buyerPan = r.buyerGstin.substring(2, 12).toUpperCase();
    const sellerPan = gstin.substring(2, 12).toUpperCase();
    if (buyerPan === sellerPan) return true;
  }
  return false;
}

export function generateGstr1Json(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  period: string,
  _summary: ConversionSummary,
  _watermark = false
): string {
  const validRows = rows.filter((r) => r.errors.length === 0);
  const fp = deriveFilingPeriod(validRows, period);

  // --- B2B ---
  const b2bRaw = validRows.filter((r) => r.invoiceType === "B2B" && !isStockTransferRow(r, gstin));
  const b2bAggMap = new Map<string, NormalizedInvoiceRow>();
  for (const r of b2bRaw) {
    const rate = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
    const key = `${r.buyerGstin}|${r.invoiceNumber.trim().toUpperCase()}|${r.placeOfSupply}|${rate}`;
    if (!b2bAggMap.has(key)) {
      b2bAggMap.set(key, { ...r });
    } else {
      const existing = b2bAggMap.get(key)!;
      existing.totalValue = r2(existing.totalValue + r.totalValue);
      existing.taxableValue = r2(existing.taxableValue + r.taxableValue);
      existing.igstAmount = r2(existing.igstAmount + r.igstAmount);
      existing.cgstAmount = r2(existing.cgstAmount + r.cgstAmount);
      existing.sgstAmount = r2(existing.sgstAmount + r.sgstAmount);
      existing.cessAmount = r2(existing.cessAmount + r.cessAmount);
      existing.quantity = r2(existing.quantity + r.quantity);
    }
  }
  const b2bRows = Array.from(b2bAggMap.values());
  const b2bMap = new Map<string, { inv: typeof b2bRows }>();
  for (const row of b2bRows) {
    const key = row.buyerGstin;
    if (!b2bMap.has(key)) b2bMap.set(key, { inv: [] });
    b2bMap.get(key)!.inv.push(row);
  }
  const b2b = Array.from(b2bMap.entries()).map(([buyerGstin, { inv }]) => ({
    ctin: buyerGstin,
    inv: inv.map((r) => ({
      inum: r.invoiceNumber,
      idt: toGstnDate(r.invoiceDate),
      val: r.totalValue,
      pos: r.placeOfSupply,
      rchrg: "N",
      inv_typ: "R",
      itms: [
        {
          num: 501,
          itm_det: {
            txval: r.taxableValue,
            rt: r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate,
            iamt: r.igstAmount > 0 ? r.igstAmount : undefined,
            camt: r.cgstAmount > 0 ? r.cgstAmount : undefined,
            samt: r.sgstAmount > 0 ? r.sgstAmount : undefined,
            csamt: 0,
          },
        },
      ],
    })),
  }));

  // --- B2CL ---
  const b2clRows = validRows.filter((r) => r.invoiceType === "B2CL");
  const b2clMap = new Map<string, typeof b2clRows>();
  for (const row of b2clRows) {
    const key = row.placeOfSupply;
    if (!b2clMap.has(key)) b2clMap.set(key, []);
    b2clMap.get(key)!.push(row);
  }
  const b2cl = Array.from(b2clMap.entries()).map(([pos, rowsList]) => ({
    pos,
    inv: rowsList.map((r) => ({
      inum: r.invoiceNumber,
      idt: toGstnDate(r.invoiceDate),
      val: r.totalValue,
      itms: [
        {
          num: 501,
          itm_det: {
            txval: r.taxableValue,
            rt: r.igstRate,
            iamt: r.igstAmount,
            csamt: 0,
          },
        },
      ],
    })),
  }));

  // --- B2CS ---
  const supplierState = gstin ? gstin.substring(0, 2) : "";
  const b2csRows = validRows.filter((r) => r.invoiceType === "B2CS" || r.invoiceType === "CDNCS");
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
      ecoGstin: string;
    }
  >();
  for (const row of b2csRows) {
    const rt = r2(row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate);
    const ecoGstin = row.ecoGstin ?? "";
    const key = `${ecoGstin}|${row.placeOfSupply}|${rt}`;
    if (!b2csMap.has(key)) {
      b2csMap.set(key, {
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
        rt,
        pos: row.placeOfSupply,
        ecoGstin,
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
      const isInter = supplierState && val.pos !== supplierState;
      return {
        sply_ty: isInter ? "INTER" : "INTRA",
        rt: val.rt,
        typ: "OE",
        pos: val.pos,
        txval: val.txval,
        ...(isInter ? { iamt: val.iamt, csamt: 0 } : { camt: val.camt, samt: val.samt, csamt: 0 }),
      };
    });

  // --- CDNR (B2B Credit Notes) ---
  const cdnrRows = validRows.filter((r) => r.invoiceType === "CDNR");
  const cdnrMap = new Map<string, typeof cdnrRows>();
  for (const row of cdnrRows) {
    const key = row.buyerGstin || "UNREGISTERED";
    if (!cdnrMap.has(key)) cdnrMap.set(key, []);
    cdnrMap.get(key)!.push(row);
  }
  const cdnr = Array.from(cdnrMap.entries()).map(([ctin, rows]) => ({
    ctin: ctin === "UNREGISTERED" ? "" : ctin,
    nt: rows.map((r) => ({
      ntty: "C",
      nt_num: r.invoiceNumber,
      nt_dt: toGstnDate(r.invoiceDate),
      val: Math.abs(r.totalValue),
      rsn: "01",
      p_gst: "N",
      itms: [
        {
          num: 501,
          itm_det: {
            txval: Math.abs(r.taxableValue),
            rt: r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate,
            iamt: Math.abs(r.igstAmount) > 0 ? Math.abs(r.igstAmount) : undefined,
            camt: Math.abs(r.cgstAmount) > 0 ? Math.abs(r.cgstAmount) : undefined,
            samt: Math.abs(r.sgstAmount) > 0 ? Math.abs(r.sgstAmount) : undefined,
            csamt: 0,
          },
        },
      ],
    })),
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
  const cdnur = cdnurRows.map((r) => ({
    typ: "OE",
    ntty: "C",
    nt_num: r.invoiceNumber,
    nt_dt: toGstnDate(r.invoiceDate),
    val: Math.abs(r.totalValue),
    pos: r.placeOfSupply,
    sply_ty: supplierState && r.placeOfSupply !== supplierState ? "INTER" : "INTRA",
    rsn: "01",
    p_gst: "N",
    itms: [
      {
        num: 501,
        itm_det: {
          txval: Math.abs(r.taxableValue),
          rt: r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate,
          iamt: Math.abs(r.igstAmount) > 0 ? Math.abs(r.igstAmount) : undefined,
          camt: Math.abs(r.cgstAmount) > 0 ? Math.abs(r.cgstAmount) : undefined,
          samt: Math.abs(r.sgstAmount) > 0 ? Math.abs(r.sgstAmount) : undefined,
          csamt: 0,
        },
      },
    ],
  }));

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
  // A stock transfer moves goods between the seller's own registrations and
  // issues no document to a customer.
  const isEligibleDocInvoice = (r: NormalizedInvoiceRow): boolean => {
    if (isStockTransferRow(r, gstin)) return false;
    const inv = r.invoiceNumber.trim();
    return /^[a-zA-Z0-9\-\/]{1,16}$/.test(inv);
  };

  // Built by the shared domain helper so the JSON and the Excel of one return
  // cannot disagree. This file grew its own prefix-grouping with no test of
  // whether a "series" was one, and enumerated every marketplace order
  // reference as a separate entry.
  const series = buildDocumentSeries(validRows.filter(isEligibleDocInvoice));

  const docSeries = (docNum: number, docTyp: DocumentSeries["documentType"]) => {
    const mine = series.filter((s) => s.documentType === docTyp);
    if (mine.length === 0) return null;
    return {
      doc_num: docNum,
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

  const docDet = [docSeries(1, "Invoices for outward supply"), docSeries(4, "Credit Note")].filter(
    (d): d is NonNullable<typeof d> => d !== null
  );

  const docIssue = docDet.length > 0 ? { doc_det: docDet } : undefined;

  // --- Table 14(a): supplies made through an e-commerce operator ---
  const ecoMap = new Map<
    string,
    { ecoName: string; txval: number; iamt: number; camt: number; samt: number; csamt: number }
  >();
  for (const row of validRows) {
    if (!row.ecoGstin || row.sourcePlatformId === "offline") continue;
    if (row.invoiceType !== "B2CS" && row.invoiceType !== "CDNCS") continue;

    let etin = ensureTcsGstin(row.ecoGstin.trim().toUpperCase());
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}C[0-9A-Z]{1}$/.test(etin)) {
      const st = supplierState || "09";
      if (etin.includes("MEESHO")) {
        etin = `${st}AAICA3918J1CR`;
      } else {
        etin = `${st}AARCM9332R1CM`;
      }
    }

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
    const sign = row.invoiceType === "CDNCS" ? -1 : 1;
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
    flag: "N",
  }));

  const gstr1 = {
    gstin,
    fp,
    version: "GST3.1.6",
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
