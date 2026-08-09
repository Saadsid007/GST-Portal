/**
 * GSTR-1 JSON Generator
 * Produces GSTN Offline Tool v3.0+ compatible JSON
 * Tables: b2b, b2cl, b2cs, cdnr, exp, hsn, supeco, doc_issue
 */

import type {
  NormalizedInvoiceRow,
  ConversionSummary,
} from "@/features/convert/types/convert.types";
import { WATERMARK_TEXT } from "@/features/billing/constants/billing.constants";

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

export function generateGstr1Json(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  period: string,
  _summary: ConversionSummary,
  watermark = false
): string {
  const validRows = rows.filter((r) => r.errors.length === 0);
  const fp = deriveFilingPeriod(validRows, period);

  // --- B2B ---
  const b2bRows = validRows.filter((r) => r.invoiceType === "B2B");
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
  const b2csRows = validRows.filter((r) => r.invoiceType === "B2CS");
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
    const bucket = b2csMap.get(key)!;
    bucket.txval = r2(bucket.txval + row.taxableValue);
    bucket.iamt = r2(bucket.iamt + row.igstAmount);
    bucket.camt = r2(bucket.camt + row.cgstAmount);
    bucket.samt = r2(bucket.samt + row.sgstAmount);
    bucket.csamt = r2(bucket.csamt + row.cessAmount);
  }
  const b2cs = Array.from(b2csMap.values()).map((val) => {
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

  // --- CDNUR (B2C Credit Notes) ---
  const cdnurRows = validRows.filter((r) => r.invoiceType === "CDNCS");
  const cdnur = cdnurRows.map((r) => ({
    typ: "B2CL",
    ntty: "C",
    nt_num: r.invoiceNumber,
    nt_dt: toGstnDate(r.invoiceDate),
    val: Math.abs(r.totalValue),
    pos: r.placeOfSupply,
    sply_ty: supplierState && r.placeOfSupply !== supplierState ? "INTER" : "INTRA",
    rsn: "01",
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

  // --- HSN Summary (split into hsn_b2b and hsn_b2c as per GSTN v3.1.6) ---
  type HsnBucket = {
    hsn: string;
    desc: string;
    uqc: string;
    txval: number;
    iamt: number;
    camt: number;
    samt: number;
    csamt: number;
    qty: number;
    rt: number;
  };
  const hsnB2bMap = new Map<string, HsnBucket>();
  const hsnB2cMap = new Map<string, HsnBucket>();
  for (const row of validRows) {
    const isB2bRow = row.invoiceType === "B2B" || row.invoiceType === "CDNR";
    const hsnTarget = isB2bRow ? hsnB2bMap : hsnB2cMap;
    const rt = r2(row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate);
    const uqc = row.uqc ?? "PCS";
    const key = `${row.hsnCode}|${rt}|${uqc}`;
    if (!hsnTarget.has(key)) {
      hsnTarget.set(key, {
        hsn: row.hsnCode,
        desc: row.itemDescription ?? "",
        uqc,
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
        qty: 0,
        rt,
      });
    }
    const sign =
      row.taxableValue < 0 || row.invoiceType === "CDNR" || row.invoiceType === "CDNCS" ? -1 : 1;
    const isB2bRow2 = row.invoiceType === "B2B" || row.invoiceType === "CDNR";
    const hsnTarget2 = isB2bRow2 ? hsnB2bMap : hsnB2cMap;
    const rt2 = r2(row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate);
    const uqc2 = row.uqc ?? "PCS";
    const key2 = `${row.hsnCode}|${rt2}|${uqc2}`;
    const b = hsnTarget2.get(key2)!;
    if (b) {
      if (!b.desc && row.itemDescription) b.desc = row.itemDescription;
      b.txval = r2(b.txval + Math.abs(row.taxableValue) * sign);
      b.iamt = r2(b.iamt + Math.abs(row.igstAmount) * sign);
      b.camt = r2(b.camt + Math.abs(row.cgstAmount) * sign);
      b.samt = r2(b.samt + Math.abs(row.sgstAmount) * sign);
      b.csamt = r2(b.csamt + Math.abs(row.cessAmount) * sign);
      b.qty = r2(b.qty + row.quantity * sign);
    }
  }
  const mapToHsnArr = (m: Map<string, HsnBucket>) =>
    Array.from(m.values()).map((val, idx) => ({
      num: idx + 1,
      hsn_sc: val.hsn,
      uqc: val.uqc,
      qty: val.qty,
      rt: val.rt,
      txval: val.txval,
      iamt: val.iamt,
      samt: val.samt,
      camt: val.camt,
      csamt: val.csamt,
    }));
  const hsn = {
    ...(hsnB2bMap.size > 0 ? { hsn_b2b: mapToHsnArr(hsnB2bMap) } : {}),
    ...(hsnB2cMap.size > 0 ? { hsn_b2c: mapToHsnArr(hsnB2cMap) } : {}),
  };

  // --- Document Summary ---
  const invoiceDocs = validRows.filter(
    (r) => r.invoiceType !== "CDNR" && r.invoiceType !== "CDNCS"
  );
  const noteDocs = validRows.filter((r) => r.invoiceType === "CDNR" || r.invoiceType === "CDNCS");
  const docSeries = (docNum: number, docTyp: string, list: NormalizedInvoiceRow[]) => {
    const numbers = list
      .map((r) => r.invoiceNumber)
      .filter(Boolean)
      .sort();
    return {
      doc_num: docNum,
      doc_typ: docTyp,
      docs: [
        {
          num: 1,
          from: numbers[0] ?? "",
          to: numbers[numbers.length - 1] ?? "",
          totnum: list.length,
          cancel: 0,
          net_issue: list.length,
        },
      ],
    };
  };
  const docIssue = {
    doc_det: [
      docSeries(1, "Invoices for outward supply", invoiceDocs),
      ...(noteDocs.length > 0 ? [docSeries(4, "Credit Notes", noteDocs)] : []),
    ],
  };

  // --- Table 14(a): supplies made through an e-commerce operator ---
  const ecoMap = new Map<
    string,
    { ecoName: string; txval: number; iamt: number; camt: number; samt: number; csamt: number }
  >();
  for (const row of validRows) {
    if (!row.ecoGstin) continue;
    if (!ecoMap.has(row.ecoGstin)) {
      ecoMap.set(row.ecoGstin, {
        ecoName: row.ecoName ?? "",
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
      });
    }
    const b = ecoMap.get(row.ecoGstin)!;
    b.txval = r2(b.txval + row.taxableValue);
    b.iamt = r2(b.iamt + row.igstAmount);
    b.camt = r2(b.camt + row.cgstAmount);
    b.samt = r2(b.samt + row.sgstAmount);
    b.csamt = r2(b.csamt + row.cessAmount);
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
    _generatedBy: watermark ? WATERMARK_TEXT : undefined,
  };

  return JSON.stringify(gstr1, null, 2);
}
