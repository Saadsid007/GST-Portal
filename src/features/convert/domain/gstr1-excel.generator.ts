/**
 * GSTR-1 Excel Generator
 * Produces authentic multi-sheet Excel files directly based on the official GSTN Offline Tool template v2.1.
 * Uses JSZip to perform direct OpenXML injection so all colors, fonts, fills, header styles,
 * named ranges, themes, and formula structures remain 100% BIT-PERFECT without any Microsoft Excel repair errors.
 */

import JSZip from "jszip";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import { getStateName } from "./state-codes";
import { ensureTcsGstin } from "@/features/convert/config/eco-registry";
import { getGstr1TemplateBuffer } from "@/features/convert/templates/template-loader";

function r2(n: number): number {
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

  let y = "";
  let m = "";
  let d = "";

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (iso) {
    y = iso[1] ?? "";
    m = iso[2] ?? "";
    d = iso[3] ?? "";
  } else {
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

function escapeXml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cellXml(
  colLetter: string,
  rowNum: number,
  styleId: number | string,
  val: any,
  type?: "str" | "num"
): string {
  const cellRef = `${colLetter}${rowNum}`;
  if (val === null || val === undefined || val === "") {
    return `<c r="${cellRef}" s="${styleId}"/>`;
  }
  if (typeof val === "number" || type === "num") {
    return `<c r="${cellRef}" s="${styleId}"><v>${val}</v></c>`;
  }
  return `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
}

/**
 * Injects data rows and formula values into a worksheet XML file,
 * preserving rows 1..4 intact with all styles, help buttons, and formula structures.
 */
function updateSheetXml(
  xml: string,
  dataRowsXml: string[],
  summaryFormulaValues?: Record<string, number | string>
): string {
  const sheetDataStart = xml.indexOf("<sheetData>");
  const sheetDataEnd = xml.indexOf("</sheetData>");
  if (sheetDataStart === -1 || sheetDataEnd === -1) return xml;

  const headerPart = xml.substring(0, sheetDataStart + "<sheetData>".length);
  const footerPart = xml.substring(sheetDataEnd);
  const innerSheetData = xml.substring(sheetDataStart + "<sheetData>".length, sheetDataEnd);

  const rows = innerSheetData.match(/<row [^>]*>[\s\S]*?<\/row>/g) || [];
  const row1 = rows[0] || "";
  const row2 = rows[1] || "";
  let row3 = rows[2] || "";
  const row4 = rows[3] || "";

  // Update formula summary <v> tags in row 3
  if (summaryFormulaValues && row3) {
    for (const [cellRef, val] of Object.entries(summaryFormulaValues)) {
      const cellRegex = new RegExp(
        `(<c r="${cellRef}"[^>]*>)(?:<f[^>]*>[^<]*<\\/f>)?(?:<v>[^<]*<\\/v>)?(<\\/c>)`,
        "g"
      );
      row3 = row3.replace(cellRegex, (match, prefix, suffix) => {
        const fMatch = match.match(/<f[^>]*>[^<]*<\/f>/);
        const fTag = fMatch ? fMatch[0] : "";
        return `${prefix}${fTag}<v>${val}</v>${suffix}`;
      });
    }
  }

  const newSheetData = [row1, row2, row3, row4, ...dataRowsXml].filter(Boolean).join("");
  let updated = `${headerPart}${newSheetData}${footerPart}`;

  // Update dimension
  const totalRows = Math.max(4 + dataRowsXml.length, 5);
  updated = updated.replace(/<dimension ref="[^"]*"/, `<dimension ref="A1:Z${totalRows}"`);

  return updated;
}

export async function generateGstr1Excel(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  _period: string,
  _watermark = false
): Promise<Uint8Array> {
  const validRows = rows.filter((r) => r.errors.length === 0);

  // Load the official 32-sheet base template ZIP
  const templateBuffer = getGstr1TemplateBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. b2b,sez,de Sheet (xl/worksheets/sheet2.xml)
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

  const b2bDataRowsXml = b2bRows.map((r, idx) => {
    const rowNum = 5 + idx;
    const rate = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
    return `<row r="${rowNum}" spans="1:13" s="19" customFormat="1">` +
      cellXml("A", rowNum, 18, r.buyerGstin || "") +
      cellXml("B", rowNum, 18, "") +
      cellXml("C", rowNum, 18, r.invoiceNumber) +
      cellXml("D", rowNum, 23, toExcelDate(r.invoiceDate)) +
      cellXml("E", rowNum, 37, r.totalValue, "num") +
      cellXml("F", rowNum, 23, posLabel(r.placeOfSupply)) +
      cellXml("G", rowNum, 23, "N") +
      cellXml("H", rowNum, 69, "") +
      cellXml("I", rowNum, 23, "Regular B2B") +
      cellXml("J", rowNum, 23, "") +
      cellXml("K", rowNum, 37, rate, "num") +
      cellXml("L", rowNum, 37, r.taxableValue, "num") +
      cellXml("M", rowNum, 37, r.cessAmount || "", r.cessAmount ? "num" : "str") +
      `</row>`;
  });

  const b2bXml = await zip.file("xl/worksheets/sheet2.xml")?.async("string");
  if (b2bXml) {
    zip.file(
      "xl/worksheets/sheet2.xml",
      updateSheetXml(b2bXml, b2bDataRowsXml, {
        A3: b2bRecipients,
        C3: b2bInvCount,
        E3: b2bTotalInvVal,
        L3: b2bTotalTxVal,
        M3: b2bTotalCess,
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. b2cl Sheet (xl/worksheets/sheet4.xml)
  // ─────────────────────────────────────────────────────────────────────────────
  const b2clRows = validRows.filter((r) => r.invoiceType === "B2CL");
  const b2clInvCount = b2clRows.length;
  const b2clTotalInvVal = r2(b2clRows.reduce((s, r) => s + r.totalValue, 0));
  const b2clTotalTxVal = r2(b2clRows.reduce((s, r) => s + r.taxableValue, 0));
  const b2clTotalCess = r2(b2clRows.reduce((s, r) => s + r.cessAmount, 0));

  const b2clDataRowsXml = b2clRows.map((r, idx) => {
    const rowNum = 5 + idx;
    return `<row r="${rowNum}" spans="1:9" s="19" customFormat="1">` +
      cellXml("A", rowNum, 18, r.invoiceNumber) +
      cellXml("B", rowNum, 23, toExcelDate(r.invoiceDate)) +
      cellXml("C", rowNum, 37, r.totalValue, "num") +
      cellXml("D", rowNum, 23, posLabel(r.placeOfSupply)) +
      cellXml("E", rowNum, 69, "") +
      cellXml("F", rowNum, 37, r2(r.igstRate), "num") +
      cellXml("G", rowNum, 37, r.taxableValue, "num") +
      cellXml("H", rowNum, 37, r.cessAmount || "", r.cessAmount ? "num" : "str") +
      cellXml("I", rowNum, 18, r.ecoGstin ? ensureTcsGstin(r.ecoGstin) : "") +
      `</row>`;
  });

  const b2clXml = await zip.file("xl/worksheets/sheet4.xml")?.async("string");
  if (b2clXml) {
    zip.file(
      "xl/worksheets/sheet4.xml",
      updateSheetXml(b2clXml, b2clDataRowsXml, {
        A3: b2clInvCount,
        C3: b2clTotalInvVal,
        G3: b2clTotalTxVal,
        H3: b2clTotalCess,
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. b2cs Sheet (xl/worksheets/sheet6.xml)
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

  const b2csDataRowsXml = b2csValues.map((v, idx) => {
    const rowNum = 5 + idx;
    return `<row r="${rowNum}" spans="1:8" s="19" customFormat="1">` +
      cellXml("A", rowNum, 26, "OE") +
      cellXml("B", rowNum, 20, posLabel(v.pos)) +
      cellXml("C", rowNum, 69, "") +
      cellXml("D", rowNum, 37, v.rt, "num") +
      cellXml("E", rowNum, 253, v.txval, "num") +
      cellXml("F", rowNum, 37, "") +
      cellXml("G", rowNum, 253, "") +
      cellXml("H", rowNum, 25, "") +
      `</row>`;
  });

  const b2csXml = await zip.file("xl/worksheets/sheet6.xml")?.async("string");
  if (b2csXml) {
    zip.file(
      "xl/worksheets/sheet6.xml",
      updateSheetXml(b2csXml, b2csDataRowsXml, {
        E3: b2csTotalTxVal,
        F3: 0,
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. cdnr Sheet (xl/worksheets/sheet8.xml)
  // ─────────────────────────────────────────────────────────────────────────────
  const cdnrRows = validRows.filter((r) => r.invoiceType === "CDNR");
  const cdnrRecipients = new Set(cdnrRows.map((r) => r.buyerGstin)).size;
  const cdnrNotes = cdnrRows.length;
  const cdnrTotalVal = r2(cdnrRows.reduce((s, r) => s + Math.abs(r.totalValue), 0));
  const cdnrTotalTxVal = r2(cdnrRows.reduce((s, r) => s + Math.abs(r.taxableValue), 0));
  const cdnrTotalCess = r2(cdnrRows.reduce((s, r) => s + Math.abs(r.cessAmount), 0));

  const cdnrDataRowsXml = cdnrRows.map((r, idx) => {
    const rowNum = 5 + idx;
    const rate = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
    return `<row r="${rowNum}" spans="1:13" s="19" customFormat="1">` +
      cellXml("A", rowNum, 18, r.buyerGstin || "") +
      cellXml("B", rowNum, 18, "") +
      cellXml("C", rowNum, 18, r.invoiceNumber) +
      cellXml("D", rowNum, 23, toExcelDate(r.invoiceDate)) +
      cellXml("E", rowNum, 23, "C") +
      cellXml("F", rowNum, 23, posLabel(r.placeOfSupply)) +
      cellXml("G", rowNum, 23, "N") +
      cellXml("H", rowNum, 23, "Regular B2B") +
      cellXml("I", rowNum, 37, Math.abs(r.totalValue), "num") +
      cellXml("J", rowNum, 69, "") +
      cellXml("K", rowNum, 37, rate, "num") +
      cellXml("L", rowNum, 37, Math.abs(r.taxableValue), "num") +
      cellXml("M", rowNum, 37, Math.abs(r.cessAmount) || "", r.cessAmount ? "num" : "str") +
      `</row>`;
  });

  const cdnrXml = await zip.file("xl/worksheets/sheet8.xml")?.async("string");
  if (cdnrXml) {
    zip.file(
      "xl/worksheets/sheet8.xml",
      updateSheetXml(cdnrXml, cdnrDataRowsXml, {
        A3: cdnrRecipients,
        C3: cdnrNotes,
        I3: cdnrTotalVal,
        L3: cdnrTotalTxVal,
        M3: cdnrTotalCess,
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. cdnur Sheet (xl/worksheets/sheet10.xml)
  // ─────────────────────────────────────────────────────────────────────────────
  const cdnurRows = validRows.filter(
    (r) => (r.invoiceType === ("CDNCS" as any)) && r.totalValue > 250000
  );
  const cdnurNotes = cdnurRows.length;
  const cdnurTotalVal = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.totalValue), 0));
  const cdnurTotalTxVal = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.taxableValue), 0));
  const cdnurTotalCess = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.cessAmount), 0));

  const cdnurDataRowsXml = cdnurRows.map((r, idx) => {
    const rowNum = 5 + idx;
    const rate = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
    return `<row r="${rowNum}" spans="1:10" s="19" customFormat="1">` +
      cellXml("A", rowNum, 23, "B2CL") +
      cellXml("B", rowNum, 18, r.invoiceNumber) +
      cellXml("C", rowNum, 23, toExcelDate(r.invoiceDate)) +
      cellXml("D", rowNum, 23, "C") +
      cellXml("E", rowNum, 23, posLabel(r.placeOfSupply)) +
      cellXml("F", rowNum, 37, Math.abs(r.totalValue), "num") +
      cellXml("G", rowNum, 69, "") +
      cellXml("H", rowNum, 37, rate, "num") +
      cellXml("I", rowNum, 37, Math.abs(r.taxableValue), "num") +
      cellXml("J", rowNum, 37, Math.abs(r.cessAmount) || "", r.cessAmount ? "num" : "str") +
      `</row>`;
  });

  const cdnurXml = await zip.file("xl/worksheets/sheet10.xml")?.async("string");
  if (cdnurXml) {
    zip.file(
      "xl/worksheets/sheet10.xml",
      updateSheetXml(cdnurXml, cdnurDataRowsXml, {
        B3: cdnurNotes,
        F3: cdnurTotalVal,
        I3: cdnurTotalTxVal,
        J3: cdnurTotalCess,
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. exp Sheet (xl/worksheets/sheet12.xml)
  // ─────────────────────────────────────────────────────────────────────────────
  const expRows = validRows.filter((r) => r.invoiceType === "EXP");
  const expInvCount = expRows.length;
  const expTotalVal = r2(expRows.reduce((s, r) => s + r.totalValue, 0));
  const expTotalTxVal = r2(expRows.reduce((s, r) => s + r.taxableValue, 0));

  const expDataRowsXml = expRows.map((r, idx) => {
    const rowNum = 5 + idx;
    return `<row r="${rowNum}" spans="1:10" s="19" customFormat="1">` +
      cellXml("A", rowNum, 23, (r as any).exportType || "WOPAY") +
      cellXml("B", rowNum, 18, r.invoiceNumber) +
      cellXml("C", rowNum, 23, toExcelDate(r.invoiceDate)) +
      cellXml("D", rowNum, 37, r.totalValue, "num") +
      cellXml("E", rowNum, 69, (r as any).portCode || "") +
      cellXml("F", rowNum, 70, (r as any).shippingBillNumber || "") +
      cellXml("G", rowNum, 23, toExcelDate((r as any).shippingBillDate || "")) +
      cellXml("H", rowNum, 37, r2(r.igstRate), "num") +
      cellXml("I", rowNum, 37, r.taxableValue, "num") +
      cellXml("J", rowNum, 37, r.cessAmount || "", r.cessAmount ? "num" : "str") +
      `</row>`;
  });

  const expXml = await zip.file("xl/worksheets/sheet12.xml")?.async("string");
  if (expXml) {
    zip.file(
      "xl/worksheets/sheet12.xml",
      updateSheetXml(expXml, expDataRowsXml, {
        B3: expInvCount,
        D3: expTotalVal,
        F3: 0,
        J3: expTotalTxVal,
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. HSN: hsn(b2b) (sheet19.xml) and hsn(b2c) (sheet20.xml)
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

  // Populate hsn(b2b) (sheet19.xml)
  const hsnB2bValues = Array.from(hsnB2bAgg.values());
  const hsnB2bCount = hsnB2bValues.length;
  const hsnB2bTotalVal = r2(hsnB2bValues.reduce((s, v) => s + v.totalVal, 0));
  const hsnB2bTotalTxVal = r2(hsnB2bValues.reduce((s, v) => s + v.txval, 0));
  const hsnB2bTotalIgst = r2(hsnB2bValues.reduce((s, v) => s + v.iamt, 0));
  const hsnB2bTotalCgst = r2(hsnB2bValues.reduce((s, v) => s + v.camt, 0));
  const hsnB2bTotalSgst = r2(hsnB2bValues.reduce((s, v) => s + v.samt, 0));
  const hsnB2bTotalCess = r2(hsnB2bValues.reduce((s, v) => s + v.csamt, 0));

  const hsnB2bDataRowsXml = hsnB2bValues.map((v, idx) => {
    const rowNum = 5 + idx;
    return `<row r="${rowNum}" spans="1:11" s="19" customFormat="1">` +
      cellXml("A", rowNum, 69, v.hsn) +
      cellXml("B", rowNum, 18, v.desc) +
      cellXml("C", rowNum, 18, toUqcFull(v.uqc)) +
      cellXml("D", rowNum, 38, v.qty, "num") +
      cellXml("E", rowNum, 38, v.totalVal, "num") +
      cellXml("F", rowNum, 38, v.rt, "num") +
      cellXml("G", rowNum, 38, v.txval, "num") +
      cellXml("H", rowNum, 38, v.iamt || "", v.iamt ? "num" : "str") +
      cellXml("I", rowNum, 38, v.camt || "", v.camt ? "num" : "str") +
      cellXml("J", rowNum, 38, v.samt || "", v.samt ? "num" : "str") +
      cellXml("K", rowNum, 38, v.csamt || "", v.csamt ? "num" : "str") +
      `</row>`;
  });

  const hsnB2bXml = await zip.file("xl/worksheets/sheet19.xml")?.async("string");
  if (hsnB2bXml) {
    zip.file(
      "xl/worksheets/sheet19.xml",
      updateSheetXml(hsnB2bXml, hsnB2bDataRowsXml, {
        A3: hsnB2bCount,
        E3: hsnB2bTotalVal,
        G3: hsnB2bTotalTxVal,
        H3: hsnB2bTotalIgst,
        I3: hsnB2bTotalCgst,
        J3: hsnB2bTotalSgst,
        K3: hsnB2bTotalCess,
      })
    );
  }

  // Populate hsn(b2c) (sheet20.xml)
  const hsnB2cValues = Array.from(hsnB2cAgg.values());
  const hsnB2cCount = hsnB2cValues.length;
  const hsnB2cTotalVal = r2(hsnB2cValues.reduce((s, v) => s + v.totalVal, 0));
  const hsnB2cTotalTxVal = r2(hsnB2cValues.reduce((s, v) => s + v.txval, 0));
  const hsnB2cTotalIgst = r2(hsnB2cValues.reduce((s, v) => s + v.iamt, 0));
  const hsnB2cTotalCgst = r2(hsnB2cValues.reduce((s, v) => s + v.camt, 0));
  const hsnB2cTotalSgst = r2(hsnB2cValues.reduce((s, v) => s + v.samt, 0));
  const hsnB2cTotalCess = r2(hsnB2cValues.reduce((s, v) => s + v.csamt, 0));

  const hsnB2cDataRowsXml = hsnB2cValues.map((v, idx) => {
    const rowNum = 5 + idx;
    return `<row r="${rowNum}" spans="1:11" s="19" customFormat="1">` +
      cellXml("A", rowNum, 69, v.hsn) +
      cellXml("B", rowNum, 18, v.desc) +
      cellXml("C", rowNum, 18, toUqcFull(v.uqc)) +
      cellXml("D", rowNum, 38, v.qty, "num") +
      cellXml("E", rowNum, 38, v.totalVal, "num") +
      cellXml("F", rowNum, 38, v.rt, "num") +
      cellXml("G", rowNum, 38, v.txval, "num") +
      cellXml("H", rowNum, 38, v.iamt || "", v.iamt ? "num" : "str") +
      cellXml("I", rowNum, 38, v.camt || "", v.camt ? "num" : "str") +
      cellXml("J", rowNum, 38, v.samt || "", v.samt ? "num" : "str") +
      cellXml("K", rowNum, 38, v.csamt || "", v.csamt ? "num" : "str") +
      `</row>`;
  });

  const hsnB2cXml = await zip.file("xl/worksheets/sheet20.xml")?.async("string");
  if (hsnB2cXml) {
    zip.file(
      "xl/worksheets/sheet20.xml",
      updateSheetXml(hsnB2cXml, hsnB2cDataRowsXml, {
        A3: hsnB2cCount,
        E3: hsnB2cTotalVal,
        G3: hsnB2cTotalTxVal,
        H3: hsnB2cTotalIgst,
        I3: hsnB2cTotalCgst,
        J3: hsnB2cTotalSgst,
        K3: hsnB2cTotalCess,
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. docs Sheet (xl/worksheets/sheet21.xml)
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

    const uniqueInvoices = Array.from(new Set(invNumbers));
    uniqueInvoices.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    const from = uniqueInvoices[0]!;
    const to = uniqueInvoices[uniqueInvoices.length - 1]!;
    const totnum = uniqueInvoices.length;
    const cancel = 0;

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

  const docsDataRowsXml = docRowsData.map((d, idx) => {
    const rowNum = 5 + idx;
    return `<row r="${rowNum}" spans="1:5" s="19" customFormat="1">` +
      cellXml("A", rowNum, 18, d.name) +
      cellXml("B", rowNum, 18, d.from) +
      cellXml("C", rowNum, 18, d.to) +
      cellXml("D", rowNum, 50, d.totnum, "num") +
      cellXml("E", rowNum, 103, d.cancel, "num") +
      `</row>`;
  });

  const docsXml = await zip.file("xl/worksheets/sheet21.xml")?.async("string");
  if (docsXml) {
    zip.file(
      "xl/worksheets/sheet21.xml",
      updateSheetXml(docsXml, docsDataRowsXml, {
        D3: docsTotalNum,
        E3: docsTotalCancel,
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. eco Sheet (xl/worksheets/sheet22.xml)
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

  const ecoDataRowsXml = ecoVals.map(([etin, v], idx) => {
    const rowNum = 5 + idx;
    return `<row r="${rowNum}" spans="1:8">` +
      cellXml("A", rowNum, 211, "Liable to collect tax u/s 52(TCS)") +
      cellXml("B", rowNum, 255, etin) +
      cellXml("C", rowNum, 215, v.ecoName) +
      cellXml("D", rowNum, 199, v.txval, "num") +
      cellXml("E", rowNum, 199, v.iamt || "", v.iamt ? "num" : "str") +
      cellXml("F", rowNum, 199, v.camt || "", v.camt ? "num" : "str") +
      cellXml("G", rowNum, 199, v.samt || "", v.samt ? "num" : "str") +
      cellXml("H", rowNum, 199, v.csamt || "", v.csamt ? "num" : "str") +
      `</row>`;
  });

  const ecoXml = await zip.file("xl/worksheets/sheet22.xml")?.async("string");
  if (ecoXml) {
    zip.file(
      "xl/worksheets/sheet22.xml",
      updateSheetXml(ecoXml, ecoDataRowsXml, {
        B3: ecoOperators,
        D3: ecoTotalSupp,
        E3: ecoTotalIgst,
        F3: ecoTotalCgst,
        G3: ecoTotalSgst,
        H3: ecoTotalCess,
      })
    );
  }

  // Export populated official template workbook
  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return buffer;
}
