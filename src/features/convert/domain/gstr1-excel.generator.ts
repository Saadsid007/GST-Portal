/**
 * GSTR-1 Excel Generator
 * Produces multi-sheet Excel matching the official GSTN Offline Tool template v2.1.
 *
 * Sheet layout follows the CA template exactly:
 *   Row 0: Section title
 *   Row 1: Summary column labels
 *   Row 2: Computed summary values
 *   Row 3: Data column headers
 *   Row 4+: Data rows
 *
 * Sheets: b2b,sez,de | b2cs | cdnr | cdnur | hsn(b2b) | hsn(b2c) | eco | docs
 */

import * as XLSX from "xlsx";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import { getStateName } from "./state-codes";

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Convert any date string (YYYY-MM-DD or DD-MM-YYYY) to dd-MMM-yyyy (e.g. 20-Jun-2026) */
function toExcelDate(dateStr: string): string {
  if (!dateStr) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  let y: string;
  let m: string;
  let d: string;

  // YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (iso) {
    y = iso[1] ?? "";
    m = iso[2] ?? "";
    d = iso[3] ?? "";
  } else {
    // DD-MM-YYYY
    const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateStr);
    if (dmy) {
      d = dmy[1] ?? "";
      m = dmy[2] ?? "";
      y = dmy[3] ?? "";
    } else {
      return dateStr;
    }
  }

  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${d}-${months[monthIdx]}-${y}`;
}

/** Map UQC short codes to GSTN full format */
function toUqcFull(uqc: string): string {
  const map: Record<string, string> = {
    PCS: "PCS-PIECES",
    NOS: "NOS-NUMBERS",
    KGS: "KGS-KILOGRAMS",
    MTR: "MTR-METRES",
    LTR: "LTR-LITRES",
    BOX: "BOX-BOX",
    BAG: "BAG-BAGS",
    OTH: "OTH-OTHERS",
    SET: "SET-SETS",
    PAC: "PAC-PACKS",
    DOZ: "DOZ-DOZENS",
    GMS: "GMS-GRAMMES",
    UNT: "UNT-UNITS",
    TON: "TON-TONNES",
    SQF: "SQF-SQUARE FEET",
    SQM: "SQM-SQUARE METRES",
    CBM: "CBM-CUBIC METRES",
    ROL: "ROL-ROLLS",
    BDL: "BDL-BUNDLES",
    BAL: "BAL-BALE",
    BKL: "BKL-BUCKLES",
    BOU: "BOU-BILLIONS OF UNITS",
    CCM: "CCM-CUBIC CENTIMETERS",
    CMS: "CMS-CENTIMETERS",
    CTN: "CTN-CARTONS",
    GGR: "GGR-GREAT GROSS",
    GRS: "GRS-GROSS",
    GYD: "GYD-GROSS YARDS",
    KLR: "KLR-KILOLITRE",
    KME: "KME-KILOMETRE",
    MLT: "MLT-MILILITRE",
    QTL: "QTL-QUINTAL",
    TBS: "TBS-TABLETS",
    THD: "THD-THOUSANDS",
    TGM: "TGM-TEN GROSS",
    YDS: "YDS-YARDS",
  };
  const upper = (uqc || "PCS").toUpperCase();
  return map[upper] ?? `${upper}-${upper}`;
}

type SheetData = (string | number | null | undefined)[][];

/**
 * Build an XLSX worksheet from raw 2D array data.
 * This gives full control over summary header rows, unlike json_to_sheet.
 */
function arrayToSheet(data: SheetData): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: POS formatting  "29" → "29-Karnataka"
// ─────────────────────────────────────────────────────────────────────────────
function posLabel(code: string): string {
  return `${code}-${getStateName(code)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export function generateGstr1Excel(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  _period: string,
  _watermark = false
): Uint8Array {
  const validRows = rows.filter((r) => r.errors.length === 0);
  const supplierState = gstin ? gstin.substring(0, 2) : "";
  const workbook = XLSX.utils.book_new();

  // ─── B2B Sheet ("b2b,sez,de") ──────────────────────────────────────────
  const b2bRows = validRows.filter((r) => r.invoiceType === "B2B");
  const b2bRecipients = new Set(b2bRows.map((r) => r.buyerGstin)).size;
  const b2bInvCount = b2bRows.length;
  const b2bTotalInvVal = r2(b2bRows.reduce((s, r) => s + r.totalValue, 0));
  const b2bTotalTxVal = r2(b2bRows.reduce((s, r) => s + r.taxableValue, 0));
  const b2bTotalCess = r2(b2bRows.reduce((s, r) => s + r.cessAmount, 0));

  const b2bSheet: SheetData = [
    [
      "Summary For B2B, SEZ, DE (4A, 4B, 6B, 6C)",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "HELP",
    ],
    [
      "No. of Recipients",
      null,
      "No. of Invoices",
      null,
      "Total Invoice Value",
      null,
      null,
      null,
      null,
      null,
      null,
      "Total Taxable Value",
      "Total Cess",
    ],
    [
      b2bRecipients,
      null,
      b2bInvCount,
      null,
      b2bTotalInvVal,
      null,
      null,
      null,
      null,
      null,
      null,
      b2bTotalTxVal,
      b2bTotalCess,
    ],
    [
      "GSTIN/UIN of Recipient",
      "Receiver Name",
      "Invoice Number",
      "Invoice date",
      "Invoice Value",
      "Place Of Supply",
      "Reverse Charge",
      "Applicable % of Tax Rate",
      "Invoice Type",
      "E-Commerce GSTIN",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
    ...b2bRows.map((r) => [
      r.buyerGstin,
      r.buyerName || "",
      r.invoiceNumber,
      toExcelDate(r.invoiceDate),
      r.totalValue,
      posLabel(r.placeOfSupply),
      "N",
      "",
      "Regular B2B",
      null,
      r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate),
      r.taxableValue,
      r.cessAmount || undefined,
    ]),
  ];
  XLSX.utils.book_append_sheet(workbook, arrayToSheet(b2bSheet), "b2b,sez,de");

  // ─── B2CS Sheet ─────────────────────────────────────────────────────────
  const b2csAgg = new Map<
    string,
    {
      txval: number;
      iamt: number;
      camt: number;
      samt: number;
      rt: number;
      pos: string;
      ecoGstin: string;
    }
  >();
  validRows
    .filter((r) => r.invoiceType === "B2CS")
    .forEach((r) => {
      const rt = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
      const ecoGstin = r.ecoGstin ?? "";
      const key = `${ecoGstin}|${r.placeOfSupply}|${rt}`;
      if (!b2csAgg.has(key)) {
        b2csAgg.set(key, {
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          rt,
          pos: r.placeOfSupply,
          ecoGstin,
        });
      }
      const b = b2csAgg.get(key)!;
      b.txval = r2(b.txval + r.taxableValue);
      b.iamt = r2(b.iamt + r.igstAmount);
      b.camt = r2(b.camt + r.cgstAmount);
      b.samt = r2(b.samt + r.sgstAmount);
    });
  const b2csValues = Array.from(b2csAgg.values());
  const b2csTotalTxVal = r2(b2csValues.reduce((s, v) => s + v.txval, 0));
  const b2csTotalCess = 0;

  const b2csSheet: SheetData = [
    ["Summary For B2CS(7)", null, null, null, null, null, "HELP"],
    [null, null, null, null, "Total Taxable  Value", "Total Cess"],
    [null, null, null, null, b2csTotalTxVal, b2csTotalCess],
    [
      "Type",
      "Place Of Supply",
      "Applicable % of Tax Rate",
      "Rate",
      "Taxable Value",
      "Cess Amount",
      "E-Commerce GSTIN",
    ],
    ...b2csValues.map((v) => [
      "OE",
      posLabel(v.pos),
      "",
      v.rt,
      v.txval,
      undefined,
      v.ecoGstin || undefined,
    ]),
  ];
  XLSX.utils.book_append_sheet(workbook, arrayToSheet(b2csSheet), "b2cs");

  // ─── CDNR Sheet (B2B Credit Notes) ─────────────────────────────────────
  const cdnrRows = validRows.filter((r) => r.invoiceType === "CDNR");
  const cdnrRecipients = new Set(cdnrRows.map((r) => r.buyerGstin)).size;
  const cdnrNotes = cdnrRows.length;
  const cdnrTotalVal = r2(cdnrRows.reduce((s, r) => s + Math.abs(r.totalValue), 0));
  const cdnrTotalTxVal = r2(cdnrRows.reduce((s, r) => s + Math.abs(r.taxableValue), 0));
  const cdnrTotalCess = r2(cdnrRows.reduce((s, r) => s + Math.abs(r.cessAmount), 0));

  const cdnrSheet: SheetData = [
    [
      "Summary For CDNR(9B)",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "HELP",
    ],
    [
      "No. of Recipients",
      null,
      "No. of Notes",
      null,
      null,
      null,
      null,
      null,
      "Total Note Value",
      null,
      null,
      "Total Taxable Value",
      "Total Cess",
    ],
    [
      cdnrRecipients,
      null,
      cdnrNotes,
      null,
      null,
      null,
      null,
      null,
      cdnrTotalVal,
      null,
      null,
      cdnrTotalTxVal,
      cdnrTotalCess,
    ],
    [
      "GSTIN/UIN of Recipient",
      "Receiver Name",
      "Note Number",
      "Note Date",
      "Note Type",
      "Place Of Supply",
      "Reverse Charge",
      "Note Supply Type",
      "Note Value",
      "Applicable % of Tax Rate",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
    ...cdnrRows.map((r) => [
      r.buyerGstin || "",
      r.buyerName || "",
      r.invoiceNumber,
      toExcelDate(r.invoiceDate),
      "C",
      posLabel(r.placeOfSupply),
      "N",
      "Regular B2B",
      Math.abs(r.totalValue),
      "",
      r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate),
      Math.abs(r.taxableValue),
      Math.abs(r.cessAmount) || undefined,
    ]),
  ];
  XLSX.utils.book_append_sheet(workbook, arrayToSheet(cdnrSheet), "cdnr");

  // ─── CDNUR Sheet (B2C Credit Notes) ────────────────────────────────────
  const cdnurRows = validRows.filter((r) => r.invoiceType === "CDNCS");
  const cdnurNotes = cdnurRows.length;
  const cdnurTotalVal = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.totalValue), 0));
  const cdnurTotalTxVal = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.taxableValue), 0));
  const cdnurTotalCess = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.cessAmount), 0));

  const cdnurSheet: SheetData = [
    ["Summary For CDNUR(9B)", null, null, null, null, null, null, null, null, "HELP"],
    [
      null,
      "No. of Notes/Vouchers",
      null,
      null,
      null,
      "Total Note Value",
      null,
      null,
      "Total Taxable Value",
      "Total Cess",
    ],
    [
      null,
      cdnurNotes,
      null,
      null,
      null,
      cdnurTotalVal,
      null,
      null,
      cdnurTotalTxVal,
      cdnurTotalCess,
    ],
    [
      "UR Type",
      "Note Number",
      "Note Date",
      "Note Type",
      "Place Of Supply",
      "Note Value",
      "Applicable % of Tax Rate",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
    ...cdnurRows.map((r) => [
      supplierState && r.placeOfSupply !== supplierState ? "B2CL" : "B2CS",
      r.invoiceNumber,
      toExcelDate(r.invoiceDate),
      "C",
      posLabel(r.placeOfSupply),
      Math.abs(r.totalValue),
      "",
      r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate),
      Math.abs(r.taxableValue),
      Math.abs(r.cessAmount) || undefined,
    ]),
  ];
  XLSX.utils.book_append_sheet(workbook, arrayToSheet(cdnurSheet), "cdnur");

  // ─── HSN(B2B) Sheet ────────────────────────────────────────────────────
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

  const buildHsnMap = (filterFn: (r: NormalizedInvoiceRow) => boolean) => {
    const map = new Map<string, HsnBucket>();
    validRows.filter(filterFn).forEach((r) => {
      const rt = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
      const uqc = r.uqc ?? "PCS";
      const key = `${r.hsnCode}|${rt}|${uqc}`;
      if (!map.has(key)) {
        map.set(key, {
          hsn: r.hsnCode,
          desc: r.itemDescription ?? "",
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
      const isCreditNote = r.invoiceType === "CDNR" || r.invoiceType === "CDNCS";
      const sign = isCreditNote ? -1 : 1;
      const b = map.get(key)!;
      if (!b.desc && r.itemDescription) b.desc = r.itemDescription;
      b.txval = r2(b.txval + Math.abs(r.taxableValue) * sign);
      b.iamt = r2(b.iamt + Math.abs(r.igstAmount) * sign);
      b.camt = r2(b.camt + Math.abs(r.cgstAmount) * sign);
      b.samt = r2(b.samt + Math.abs(r.sgstAmount) * sign);
      b.csamt = r2(b.csamt + Math.abs(r.cessAmount) * sign);
      b.qty = r2(b.qty + r.quantity * sign);
    });
    return map;
  };

  const buildHsnSheet = (map: Map<string, HsnBucket>): SheetData => {
    const vals = Array.from(map.values());
    const hsnCount = vals.length;
    const totalVal = r2(vals.reduce((s, v) => s + v.txval + v.iamt + v.camt + v.samt + v.csamt, 0));
    const totalTxVal = r2(vals.reduce((s, v) => s + v.txval, 0));
    const totalIamt = r2(vals.reduce((s, v) => s + v.iamt, 0));
    const totalCamt = r2(vals.reduce((s, v) => s + v.camt, 0));
    const totalSamt = r2(vals.reduce((s, v) => s + v.samt, 0));
    const totalCess = r2(vals.reduce((s, v) => s + v.csamt, 0));

    return [
      ["Summary For HSN(12)", null, null, null, null, null, null, null, null, null, "HELP"],
      [
        "No. of HSN",
        null,
        null,
        null,
        "Total Value",
        null,
        "Total Taxable Value",
        "Total Integrated Tax",
        "Total Central Tax",
        "Total State/UT Tax",
        "Total Cess",
      ],
      [
        hsnCount,
        null,
        null,
        null,
        totalVal,
        null,
        totalTxVal,
        totalIamt,
        totalCamt,
        totalSamt,
        totalCess,
      ],
      [
        "HSN",
        "Description",
        "UQC",
        "Total Quantity",
        "Total Value",
        "Rate",
        "Taxable Value",
        "Integrated Tax Amount",
        "Central Tax Amount",
        "State/UT Tax Amount",
        "Cess Amount",
      ],
      ...vals.map((v) => [
        v.hsn,
        v.desc || null,
        toUqcFull(v.uqc),
        Math.max(0, v.qty),
        r2(Math.max(0, v.txval) + Math.max(0, v.iamt) + Math.max(0, v.camt) + Math.max(0, v.samt)),
        v.rt,
        Math.max(0, v.txval),
        Math.max(0, v.iamt),
        Math.max(0, v.camt),
        Math.max(0, v.samt),
        Math.max(0, v.csamt) || undefined,
      ]),
    ];
  };

  const hsnB2bMap = buildHsnMap((r) => r.invoiceType === "B2B" || r.invoiceType === "CDNR");
  const hsnB2cMap = buildHsnMap(
    (r) => r.invoiceType === "B2CS" || r.invoiceType === "B2CL" || r.invoiceType === "CDNCS"
  );

  XLSX.utils.book_append_sheet(workbook, arrayToSheet(buildHsnSheet(hsnB2bMap)), "hsn(b2b)");
  XLSX.utils.book_append_sheet(workbook, arrayToSheet(buildHsnSheet(hsnB2cMap)), "hsn(b2c)");

  // ─── DOCS Sheet ────────────────────────────────────────────────────────
  // Split invoices by prefix (BLR7, BLR8, etc.) and compute cancelled from sequence gaps.
  const invoiceDocs = validRows.filter(
    (r) => r.invoiceType !== "CDNR" && r.invoiceType !== "CDNCS"
  );
  const noteDocs = validRows.filter((r) => r.invoiceType === "CDNR" || r.invoiceType === "CDNCS");

  type DocSeriesEntry = {
    nature: string;
    from: string;
    to: string;
    totnum: number;
    cancel: number;
  };

  const buildDocSeries = (nature: string, list: NormalizedInvoiceRow[]): DocSeriesEntry[] => {
    if (list.length === 0) return [];

    // Group by prefix (everything before the last dash+number segment)
    const prefixGroups = new Map<string, string[]>();
    for (const r of list) {
      const inv = r.invoiceNumber;
      // Extract prefix: "BLR7-652" → "BLR7", "BLR8-T-2" → "BLR8-T"
      const lastDash = inv.lastIndexOf("-");
      const prefix = lastDash > 0 ? inv.substring(0, lastDash) : inv;
      if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, []);
      prefixGroups.get(prefix)!.push(inv);
    }

    const series: DocSeriesEntry[] = [];
    for (const [, invoices] of prefixGroups) {
      // Sort by numeric suffix
      const sorted = [...invoices].sort((a, b) => {
        const numA = parseInt((a.match(/\d+/g) || []).pop() || "0", 10);
        const numB = parseInt((b.match(/\d+/g) || []).pop() || "0", 10);
        return numA - numB;
      });

      const first = sorted[0] ?? "";
      const last = sorted[sorted.length - 1] ?? "";
      const firstNum = parseInt((first.match(/\d+/g) || []).pop() || "0", 10);
      const lastNum = parseInt((last.match(/\d+/g) || []).pop() || "0", 10);

      const actualCount = sorted.length;
      const rangeCount = lastNum >= firstNum && firstNum > 0 ? lastNum - firstNum + 1 : actualCount;
      const totnum = Math.max(actualCount, rangeCount);
      const cancel = Math.max(0, totnum - actualCount);

      series.push({ nature, from: first, to: last, totnum, cancel });
    }
    return series;
  };

  const allDocSeries = [
    ...buildDocSeries("Invoices for outward supply", invoiceDocs),
    ...buildDocSeries("Credit Note", noteDocs),
  ];

  const docsTotalNum = allDocSeries.reduce((s, d) => s + d.totnum, 0);
  const docsTotalCancel = allDocSeries.reduce((s, d) => s + d.cancel, 0);

  const docsSheet: SheetData = [
    ["Summary of documents issued during the tax period (13)", null, null, null, "HELP"],
    [null, null, null, "Total Number", "Total Cancelled"],
    [null, null, null, docsTotalNum, docsTotalCancel],
    ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"],
    ...allDocSeries.map((d) => [d.nature, d.from, d.to, d.totnum, d.cancel]),
  ];
  XLSX.utils.book_append_sheet(workbook, arrayToSheet(docsSheet), "docs");

  // ─── ECO Sheet (Table 14a — matching CA: B2B + B2C combined) ───────────
  const ecoAgg = new Map<
    string,
    { ecoName: string; txval: number; iamt: number; camt: number; samt: number; csamt: number }
  >();
  validRows.forEach((r) => {
    if (!r.ecoGstin) return;
    const isCreditNote = r.invoiceType === "CDNR" || r.invoiceType === "CDNCS";
    const sign = isCreditNote ? -1 : 1;
    if (!ecoAgg.has(r.ecoGstin)) {
      ecoAgg.set(r.ecoGstin, {
        ecoName: r.ecoName ?? "",
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
      });
    }
    const b = ecoAgg.get(r.ecoGstin)!;
    b.txval = r2(b.txval + Math.abs(r.taxableValue) * sign);
    b.iamt = r2(b.iamt + Math.abs(r.igstAmount) * sign);
    b.camt = r2(b.camt + Math.abs(r.cgstAmount) * sign);
    b.samt = r2(b.samt + Math.abs(r.sgstAmount) * sign);
    b.csamt = r2(b.csamt + Math.abs(r.cessAmount) * sign);
  });
  const ecoVals = Array.from(ecoAgg.entries());
  const ecoOperators = ecoVals.length;
  const ecoTotalSupp = r2(ecoVals.reduce((s, [, v]) => s + v.txval, 0));
  const ecoTotalIgst = r2(ecoVals.reduce((s, [, v]) => s + v.iamt, 0));
  const ecoTotalCgst = r2(ecoVals.reduce((s, [, v]) => s + v.camt, 0));
  const ecoTotalSgst = r2(ecoVals.reduce((s, [, v]) => s + v.samt, 0));
  const ecoTotalCess = r2(ecoVals.reduce((s, [, v]) => s + v.csamt, 0));

  const ecoSheet: SheetData = [
    ["Summary For Supplies through ECO-14", null, null, null, null, null, null, "HELP"],
    [
      null,
      "No. of E-Commerce Operator",
      null,
      "Total Net Value of Supplies",
      "Total Integrated Tax",
      "Total Central Tax ",
      "Total State/UT Tax ",
      "Total Cess",
    ],
    [
      null,
      ecoOperators,
      null,
      ecoTotalSupp,
      ecoTotalIgst,
      ecoTotalCgst,
      ecoTotalSgst,
      ecoTotalCess,
    ],
    [
      "Nature of Supply",
      "GSTIN of E-Commerce Operator",
      "E-Commerce Operator Name",
      "Net value of supplies",
      "Integrated tax",
      "Central tax",
      "State/UT tax",
      "Cess",
    ],
    ...ecoVals.map(([etin, v]) => [
      "Liable to collect tax u/s 52(TCS)",
      etin,
      v.ecoName || null,
      v.txval,
      v.iamt,
      v.camt,
      v.samt,
      v.csamt || undefined,
    ]),
  ];
  XLSX.utils.book_append_sheet(workbook, arrayToSheet(ecoSheet), "eco");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Uint8Array;
}
