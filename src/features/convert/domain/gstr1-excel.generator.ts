/**
 * GSTR-1 Excel Generator
 * Produces multi-sheet Excel by populating the official GSTN Offline Tool template v2.1.
 * Preserves all 32 worksheets, styling, formatting, and dropdown validation from the official template.
 */

import * as XLSX from "xlsx";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import { getStateName } from "./state-codes";
import { ensureTcsGstin } from "@/features/convert/config/eco-registry";
import { getGstr1TemplateBuffer } from "@/features/convert/templates/template-loader";

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
  const upper = (uqc || "PCS").toUpperCase();
  if (upper === "NOS" || upper === "NOS-NUMBERS" || upper === "PCS") return "PCS-PIECES";
  const map: Record<string, string> = {
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
  return map[upper] ?? `${upper}-${upper}`;
}

function posLabel(code: string): string {
  return `${code}-${getStateName(code)}`;
}

function isStockTransferRow(r: NormalizedInvoiceRow): boolean {
  return (
    r.sourcePlatformId === "stock_transfer" ||
    (Boolean(r.sourceFileName) && (r.sourceFileName?.toLowerCase().includes("stock_transfer") ?? false))
  );
}

/**
 * Populates a worksheet inside the template workbook.
 * - Updates summary cells in Row 2 (0-indexed).
 * - Clears previous placeholder rows.
 * - Writes data rows starting at Row 4 (0-indexed / Excel row 5).
 * - Updates worksheet !ref range.
 */
function populateSheet(
  ws: XLSX.WorkSheet | undefined,
  summaryUpdates: Record<number, number | string>,
  dataRows: (string | number | null | undefined)[][],
  maxCols: number
) {
  if (!ws) return;

  // 1. Update summary cells in Row 2 (0-indexed row 2)
  for (const [colIdxStr, val] of Object.entries(summaryUpdates)) {
    const col = Number(colIdxStr);
    const cellRef = XLSX.utils.encode_cell({ r: 2, c: col });
    ws[cellRef] = {
      t: typeof val === "number" ? "n" : "s",
      v: val,
    };
  }

  // 2. Clear previous template data rows (Row 4 onwards)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:Z100");
  for (let r = 4; r <= range.e.r; r++) {
    for (let c = 0; c <= Math.max(range.e.c, maxCols); c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      delete ws[cellRef];
    }
  }

  // 3. Add data rows starting from row 4 (Excel row 5, 'A5')
  if (dataRows.length > 0) {
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A5" });
  }

  // 4. Update !ref
  const totalRows = Math.max(4 + dataRows.length, 4);
  const totalCols = Math.max(range.e.c, maxCols - 1);
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRows - 1, c: totalCols },
  });
}

export function generateGstr1Excel(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  _period: string,
  _watermark = false
): Uint8Array {
  const validRows = rows.filter((r) => r.errors.length === 0);

  // Load the official 32-sheet base template
  const templateBuffer = getGstr1TemplateBuffer();
  const workbook = XLSX.read(templateBuffer, {
    type: "buffer",
    cellStyles: true,
    cellNF: true,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. b2b,sez,de Sheet (Table 4A, 4B, 6B, 6C)
  // ─────────────────────────────────────────────────────────────────────────────
  const b2bRaw = validRows.filter((r) => r.invoiceType === "B2B");
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
  const b2bRecipients = new Set(b2bRows.map((r) => r.buyerGstin)).size;
  const b2bInvCount = b2bRows.length;
  const b2bTotalInvVal = r2(b2bRows.reduce((s, r) => s + r.totalValue, 0));
  const b2bTotalTxVal = r2(b2bRows.reduce((s, r) => s + r.taxableValue, 0));
  const b2bTotalCess = r2(b2bRows.reduce((s, r) => s + r.cessAmount, 0));

  const b2bDataRows = b2bRows.map((r) => [
    r.buyerGstin || "",
    "", // Blank Receiver Name as per official CA practice
    r.invoiceNumber,
    toExcelDate(r.invoiceDate),
    r.totalValue,
    posLabel(r.placeOfSupply),
    "N",
    "",
    "Regular B2B",
    "",
    r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate),
    r.taxableValue,
    r.cessAmount || undefined,
  ]);

  populateSheet(
    workbook.Sheets["b2b,sez,de"],
    {
      0: b2bRecipients,
      2: b2bInvCount,
      4: b2bTotalInvVal,
      11: b2bTotalTxVal,
      12: b2bTotalCess,
    },
    b2bDataRows,
    13
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. b2cl Sheet (Table 5 — B2C Large > ₹2.5 Lakh Inter-State)
  // ─────────────────────────────────────────────────────────────────────────────
  const b2clRows = validRows.filter((r) => r.invoiceType === "B2CL");
  const b2clInvCount = b2clRows.length;
  const b2clTotalInvVal = r2(b2clRows.reduce((s, r) => s + r.totalValue, 0));
  const b2clTotalTxVal = r2(b2clRows.reduce((s, r) => s + r.taxableValue, 0));
  const b2clTotalCess = r2(b2clRows.reduce((s, r) => s + r.cessAmount, 0));

  const b2clDataRows = b2clRows.map((r) => [
    r.invoiceNumber,
    toExcelDate(r.invoiceDate),
    r.totalValue,
    posLabel(r.placeOfSupply),
    "",
    r2(r.igstRate),
    r.taxableValue,
    r.cessAmount || undefined,
    r.ecoGstin ? ensureTcsGstin(r.ecoGstin) : "",
  ]);

  populateSheet(
    workbook.Sheets["b2cl"],
    {
      0: b2clInvCount,
      2: b2clTotalInvVal,
      6: b2clTotalTxVal,
      7: b2clTotalCess,
    },
    b2clDataRows,
    9
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. b2cs Sheet (Table 7 — B2C Small)
  // ─────────────────────────────────────────────────────────────────────────────
  const b2csAgg = new Map<
    string,
    { txval: number; iamt: number; camt: number; samt: number; rt: number; pos: string }
  >();
  validRows
    .filter((r) => (r.invoiceType === "B2CS" || r.invoiceType === "CDNCS") && Boolean(r.placeOfSupply))
    .forEach((r) => {
      const rt = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
      const key = `${r.placeOfSupply}|${rt}`;
      if (!b2csAgg.has(key)) {
        b2csAgg.set(key, { txval: 0, iamt: 0, camt: 0, samt: 0, rt, pos: r.placeOfSupply });
      }
      const sign = r.invoiceType === "CDNCS" ? -1 : 1;
      const b = b2csAgg.get(key)!;
      b.txval = r2(b.txval + Math.abs(r.taxableValue) * sign);
      b.iamt = r2(b.iamt + Math.abs(r.igstAmount) * sign);
      b.camt = r2(b.camt + Math.abs(r.cgstAmount) * sign);
      b.samt = r2(b.samt + Math.abs(r.sgstAmount) * sign);
    });

  const b2csValues = Array.from(b2csAgg.values()).filter((v) => Math.abs(v.txval) > 0.001);
  const b2csTotalTxVal = r2(b2csValues.reduce((s, v) => s + v.txval, 0));

  const b2csDataRows = b2csValues.map((v) => [
    "OE",
    posLabel(v.pos),
    "",
    v.rt,
    v.txval,
    undefined,
    "", // Blank in official template (Table 14 handles ECO)
  ]);

  populateSheet(
    workbook.Sheets["b2cs"],
    {
      4: b2csTotalTxVal,
      5: 0,
    },
    b2csDataRows,
    7
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. cdnr Sheet (Table 9B — Registered Credit / Debit Notes)
  // ─────────────────────────────────────────────────────────────────────────────
  const cdnrRows = validRows.filter((r) => r.invoiceType === "CDNR");
  const cdnrRecipients = new Set(cdnrRows.map((r) => r.buyerGstin)).size;
  const cdnrNotes = cdnrRows.length;
  const cdnrTotalVal = r2(cdnrRows.reduce((s, r) => s + Math.abs(r.totalValue), 0));
  const cdnrTotalTxVal = r2(cdnrRows.reduce((s, r) => s + Math.abs(r.taxableValue), 0));
  const cdnrTotalCess = r2(cdnrRows.reduce((s, r) => s + Math.abs(r.cessAmount), 0));

  const cdnrDataRows = cdnrRows.map((r) => [
    r.buyerGstin || "",
    "",
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
  ]);

  populateSheet(
    workbook.Sheets["cdnr"],
    {
      0: cdnrRecipients,
      2: cdnrNotes,
      8: cdnrTotalVal,
      11: cdnrTotalTxVal,
      12: cdnrTotalCess,
    },
    cdnrDataRows,
    13
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. cdnur Sheet (Table 9B — Unregistered B2CL Credit / Debit Notes)
  // ─────────────────────────────────────────────────────────────────────────────
  const cdnurRows = validRows.filter(
    (r) => (r.invoiceType === ("CDNCS" as any)) && r.totalValue > 250000
  );
  const cdnurNotes = cdnurRows.length;
  const cdnurTotalVal = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.totalValue), 0));
  const cdnurTotalTxVal = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.taxableValue), 0));
  const cdnurTotalCess = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.cessAmount), 0));

  const cdnurDataRows = cdnurRows.map((r) => [
    "B2CL",
    r.invoiceNumber,
    toExcelDate(r.invoiceDate),
    "C",
    posLabel(r.placeOfSupply),
    Math.abs(r.totalValue),
    "",
    r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate),
    Math.abs(r.taxableValue),
    Math.abs(r.cessAmount) || undefined,
  ]);

  populateSheet(
    workbook.Sheets["cdnur"],
    {
      1: cdnurNotes,
      5: cdnurTotalVal,
      8: cdnurTotalTxVal,
      9: cdnurTotalCess,
    },
    cdnurDataRows,
    10
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. exp Sheet (Table 6A — Exports)
  // ─────────────────────────────────────────────────────────────────────────────
  const expRows = validRows.filter((r) => r.invoiceType === "EXP");
  const expInvCount = expRows.length;
  const expTotalVal = r2(expRows.reduce((s, r) => s + r.totalValue, 0));
  const expTotalTxVal = r2(expRows.reduce((s, r) => s + r.taxableValue, 0));
  const expTotalCess = r2(expRows.reduce((s, r) => s + r.cessAmount, 0));

  const expDataRows = expRows.map((r) => [
    (r as any).exportType || "WOPAY",
    r.invoiceNumber,
    toExcelDate(r.invoiceDate),
    r.totalValue,
    (r as any).portCode || "",
    (r as any).shippingBillNumber || "",
    toExcelDate((r as any).shippingBillDate || ""),
    r2(r.igstRate),
    r.taxableValue,
    r.cessAmount || undefined,
  ]);

  populateSheet(
    workbook.Sheets["exp"],
    {
      1: expInvCount,
      3: expTotalVal,
      5: 0,
      9: expTotalTxVal,
    },
    expDataRows,
    10
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. HSN Aggregation: hsn(b2b) and hsn(b2c) (Table 12)
  // ─────────────────────────────────────────────────────────────────────────────
  type HsnAgg = {
    hsn: string;
    desc: string;
    uqc: string;
    qty: number;
    totalVal: number;
    rt: number;
    txval: number;
    iamt: number;
    camt: number;
    samt: number;
    csamt: number;
  };

  const hsnB2bAgg = new Map<string, HsnAgg>();
  const hsnB2cAgg = new Map<string, HsnAgg>();

  for (const r of validRows) {
    if (!r.hsnCode) continue;
    const isB2B = r.invoiceType === "B2B" || r.invoiceType === "CDNR";
    const targetMap = isB2B ? hsnB2bAgg : hsnB2cAgg;

    const rt = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
    const uqc = r.uqc || "PCS";
    const key = `${r.hsnCode}|${rt}|${uqc}`;

    if (!targetMap.has(key)) {
      targetMap.set(key, {
        hsn: r.hsnCode,
        desc: r.itemDescription || "",
        uqc,
        qty: 0,
        totalVal: 0,
        rt,
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
      });
    }

    const sign = r.invoiceType === "CDNR" || r.invoiceType === "CDNCS" ? -1 : 1;
    const b = targetMap.get(key)!;
    if (!b.desc && r.itemDescription) b.desc = r.itemDescription;
    b.qty = r2(b.qty + r.quantity * sign);
    b.totalVal = r2(b.totalVal + Math.abs(r.totalValue) * sign);
    b.txval = r2(b.txval + Math.abs(r.taxableValue) * sign);
    b.iamt = r2(b.iamt + Math.abs(r.igstAmount) * sign);
    b.camt = r2(b.camt + Math.abs(r.cgstAmount) * sign);
    b.samt = r2(b.samt + Math.abs(r.sgstAmount) * sign);
    b.csamt = r2(b.csamt + Math.abs(r.cessAmount) * sign);
  }

  // Populate hsn(b2b)
  const hsnB2bValues = Array.from(hsnB2bAgg.values());
  const hsnB2bCount = hsnB2bValues.length;
  const hsnB2bTotalVal = r2(hsnB2bValues.reduce((s, v) => s + v.totalVal, 0));
  const hsnB2bTotalTxVal = r2(hsnB2bValues.reduce((s, v) => s + v.txval, 0));
  const hsnB2bTotalIgst = r2(hsnB2bValues.reduce((s, v) => s + v.iamt, 0));
  const hsnB2bTotalCgst = r2(hsnB2bValues.reduce((s, v) => s + v.camt, 0));
  const hsnB2bTotalSgst = r2(hsnB2bValues.reduce((s, v) => s + v.samt, 0));
  const hsnB2bTotalCess = r2(hsnB2bValues.reduce((s, v) => s + v.csamt, 0));

  const hsnB2bDataRows = hsnB2bValues.map((v) => [
    v.hsn,
    v.desc,
    toUqcFull(v.uqc),
    v.qty,
    v.totalVal,
    v.rt,
    v.txval,
    v.iamt > 0 ? v.iamt : undefined,
    v.camt > 0 ? v.camt : undefined,
    v.samt > 0 ? v.samt : undefined,
    v.csamt > 0 ? v.csamt : undefined,
  ]);

  populateSheet(
    workbook.Sheets["hsn(b2b)"],
    {
      0: hsnB2bCount,
      4: hsnB2bTotalVal,
      6: hsnB2bTotalTxVal,
      7: hsnB2bTotalIgst,
      8: hsnB2bTotalCgst,
      9: hsnB2bTotalSgst,
      10: hsnB2bTotalCess,
    },
    hsnB2bDataRows,
    11
  );

  // Populate hsn(b2c)
  const hsnB2cValues = Array.from(hsnB2cAgg.values());
  const hsnB2cCount = hsnB2cValues.length;
  const hsnB2cTotalVal = r2(hsnB2cValues.reduce((s, v) => s + v.totalVal, 0));
  const hsnB2cTotalTxVal = r2(hsnB2cValues.reduce((s, v) => s + v.txval, 0));
  const hsnB2cTotalIgst = r2(hsnB2cValues.reduce((s, v) => s + v.iamt, 0));
  const hsnB2cTotalCgst = r2(hsnB2cValues.reduce((s, v) => s + v.camt, 0));
  const hsnB2cTotalSgst = r2(hsnB2cValues.reduce((s, v) => s + v.samt, 0));
  const hsnB2cTotalCess = r2(hsnB2cValues.reduce((s, v) => s + v.csamt, 0));

  const hsnB2cDataRows = hsnB2cValues.map((v) => [
    v.hsn,
    v.desc,
    toUqcFull(v.uqc),
    v.qty,
    v.totalVal,
    v.rt,
    v.txval,
    v.iamt > 0 ? v.iamt : undefined,
    v.camt > 0 ? v.camt : undefined,
    v.samt > 0 ? v.samt : undefined,
    v.csamt > 0 ? v.csamt : undefined,
  ]);

  populateSheet(
    workbook.Sheets["hsn(b2c)"],
    {
      0: hsnB2cCount,
      4: hsnB2cTotalVal,
      6: hsnB2cTotalTxVal,
      7: hsnB2cTotalIgst,
      8: hsnB2cTotalCgst,
      9: hsnB2cTotalSgst,
      10: hsnB2cTotalCess,
    },
    hsnB2cDataRows,
    11
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. docs Sheet (Table 13 — Summary of Documents Issued)
  // ─────────────────────────────────────────────────────────────────────────────
  const invoiceGroups = new Map<string, string[]>();
  validRows.forEach((r) => {
    const isCreditNote = r.invoiceType === "CDNR" || r.invoiceType === "CDNCS";
    const groupName = isCreditNote ? "Credit Note" : "Invoices for outward supply";
    if (!invoiceGroups.has(groupName)) invoiceGroups.set(groupName, []);
    if (r.invoiceNumber) {
      invoiceGroups.get(groupName)!.push(r.invoiceNumber.trim());
    }
  });

  const docRowsData: {
    name: string;
    from: string;
    to: string;
    totnum: number;
    cancel: number;
  }[] = [];

  invoiceGroups.forEach((invNumbers, name) => {
    if (invNumbers.length === 0) return;

    // Natural sort
    invNumbers.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    const from = invNumbers[0]!;
    const to = invNumbers[invNumbers.length - 1]!;

    const mFrom = from.match(/(\d+)$/);
    const mTo = to.match(/(\d+)$/);

    let totnum = invNumbers.length;
    let cancel = 0;

    if (mFrom && mTo) {
      const firstNum = parseInt(mFrom[1]!, 10);
      const lastNum = parseInt(mTo[1]!, 10);
      if (lastNum >= firstNum) {
        totnum = lastNum - firstNum + 1;
        cancel = Math.max(0, totnum - invNumbers.length);
      }
    }

    docRowsData.push({
      name,
      from,
      to,
      totnum,
      cancel,
    });
  });

  const docsTotalNum = docRowsData.reduce((s, d) => s + d.totnum, 0);
  const docsTotalCancel = docRowsData.reduce((s, d) => s + d.cancel, 0);

  const docsDataRows = docRowsData.map((d) => [
    d.name,
    d.from,
    d.to,
    d.totnum,
    d.cancel,
  ]);

  populateSheet(
    workbook.Sheets["docs"],
    {
      3: docsTotalNum,
      4: docsTotalCancel,
    },
    docsDataRows,
    5
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. eco Sheet (Table 14 — Supplies Made Through E-Commerce Operators)
  // ─────────────────────────────────────────────────────────────────────────────
  const ecoAgg = new Map<
    string,
    { ecoName: string; txval: number; iamt: number; camt: number; samt: number; csamt: number }
  >();

  validRows
    .filter((r) => !isStockTransferRow(r) && r.sourcePlatformId !== "offline" && Boolean(r.ecoGstin))
    .forEach((r) => {
      const etin = ensureTcsGstin(r.ecoGstin!);
      const isCreditNote = r.invoiceType === "CDNR" || r.invoiceType === "CDNCS";
      const sign = isCreditNote ? -1 : 1;
      if (!ecoAgg.has(etin)) {
        ecoAgg.set(etin, { ecoName: r.ecoName || "", txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 });
      }
      const b = ecoAgg.get(etin)!;
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

  const ecoDataRows = ecoVals.map(([etin, v]) => [
    "Liable to collect tax u/s 52(TCS)",
    etin,
    v.ecoName,
    v.txval,
    v.iamt > 0 ? v.iamt : undefined,
    v.camt > 0 ? v.camt : undefined,
    v.samt > 0 ? v.samt : undefined,
    v.csamt > 0 ? v.csamt : undefined,
  ]);

  populateSheet(
    workbook.Sheets["eco"],
    {
      1: ecoOperators,
      3: ecoTotalSupp,
      4: ecoTotalIgst,
      5: ecoTotalCgst,
      6: ecoTotalSgst,
      7: ecoTotalCess,
    },
    ecoDataRows,
    8
  );

  // Export populated official template workbook
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });

  return new Uint8Array(buffer);
}
