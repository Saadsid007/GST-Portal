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
    (Boolean(r.sourceFileName) &&
      (r.sourceFileName?.toLowerCase().includes("stock_transfer") ?? false))
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
  val: string | number | null | undefined,
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
/** Escapes a literal for embedding in a RegExp source. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Canonicalises an HSN code for Table 12.
 *
 * Marketplace feeds spell the same commodity several ways — "4419" on one line
 * and "441900" on the next — which split one HSN into two rows that then
 * disagree with the CA's return. A 4-digit chapter heading is padded to the
 * 6-digit form the rest of the file uses, so both land in the same bucket.
 *
 * Returns "" for a code that classifies nothing: absent, or all zeros. Such a
 * row is rejected by the portal, and carrying it forward only hides the fact
 * that those items were never classified.
 */
function normalizeHsn(raw: string | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) return "";
  // 2-digit chapters are too coarse to report; 4 pads to 6, 6 and 8 stand.
  if (digits.length < 4) return "";
  if (digits.length === 4) return `${digits}00`;
  if (digits.length === 5) return `${digits}0`;
  if (digits.length === 7) return digits.slice(0, 6);
  return digits.length > 8 ? digits.slice(0, 8) : digits;
}

/**
 * One readable description per HSN row.
 *
 * Aggregation used to concatenate every product title that shared an HSN,
 * producing a single cell holding six titles joined by semicolons — unreadable,
 * and long enough to look like corruption. Table 12 wants the commodity, not the
 * catalogue.
 */
function hsnDescription(raw: string | undefined): string {
  const first = String(raw ?? "")
    .split(";")[0]!
    .replace(/\s+/g, " ")
    .trim();
  return first.length > 60 ? `${first.slice(0, 57)}...` : first;
}

/**
 * The series stem of a document number — everything before its trailing digits.
 *
 * "IN-1024" and "IN-707" share the stem "IN-"; "2026-2027/57" gives
 * "2026-2027/". Table 13 wants one row per series with its own from/to range,
 * and mixing series produced a range that spanned two unrelated books.
 */
function documentSeries(invoiceNumber: string): string {
  return invoiceNumber.replace(/\d+\s*$/, "") || "#";
}

/**
 * Collapses stems that are not really series.
 *
 * A marketplace order id like "00016573357568_1" yields a stem unique to itself,
 * so keying on the stem alone turns a thousand orders into a thousand Table 13
 * rows. A genuine series is shared: many documents carry the same stem. Anything
 * that appears once and carries no letters is an order id, and they are reported
 * together as one block rather than enumerated.
 */
function isRealSeries(stem: string, documentCount: number): boolean {
  // A marketplace order id is a long unbroken run of digits — 14 of them here —
  // whereas a real series stem is short and punctuated: "IN-", "CN-",
  // "2026-2027/". Counting documents alone is not enough: one order that was
  // split across two shipments shares a stem and would otherwise pass as a
  // two-document series.
  const longestDigitRun = Math.max(0, ...(stem.match(/\d+/g) ?? []).map((run) => run.length));
  if (longestDigitRun >= 10) return false;

  return documentCount > 1 || /[A-Za-z]/.test(stem);
}

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

  // Update the cached values behind row 3's summary formulas.
  //
  // The template writes a shared formula across G3:K3: G3 carries the master
  // `<f t="shared" ref="G3:K3" si="0">SUM(G5:G2000)</f>` and H3:K3 carry a
  // SELF-CLOSING `<f t="shared" si="0"/>`. An earlier pattern only recognised
  // `<f …>text</f>`, so those four cells never matched and kept the blank
  // template's cached zero — every HSN sheet shipped with its tax totals
  // reading 0.00 while the rows beneath it plainly had tax.
  //
  // Cells can also be self-closing when the template leaves them empty, which
  // needs the `<c …/>` form expanded before a value can go in.
  if (summaryFormulaValues && row3) {
    for (const [cellRef, val] of Object.entries(summaryFormulaValues)) {
      const openTag = `<c r="${cellRef}"`;
      const selfClosing = new RegExp(`${escapeForRegExp(openTag)}([^>]*)\\/>`, "g");
      row3 = row3.replace(
        selfClosing,
        (_m, attrs: string) => `${openTag}${attrs}><v>${val}</v></c>`
      );

      const paired = new RegExp(`(${escapeForRegExp(openTag)}[^>]*>)([\\s\\S]*?)(<\\/c>)`, "g");
      row3 = row3.replace(paired, (_m, prefix: string, body: string, suffix: string) => {
        // Keep whichever form the formula takes; only the cached value changes.
        const fTag = body.match(/<f[^>]*\/>|<f[^>]*>[\s\S]*?<\/f>/)?.[0] ?? "";
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
    return (
      `<row r="${rowNum}" spans="1:13" s="19" customFormat="1">` +
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
      cellXml("M", rowNum, 37, r2(r.cessAmount), "num") +
      `</row>`
    );
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
    return (
      `<row r="${rowNum}" spans="1:9" s="19" customFormat="1">` +
      cellXml("A", rowNum, 18, r.invoiceNumber) +
      cellXml("B", rowNum, 23, toExcelDate(r.invoiceDate)) +
      cellXml("C", rowNum, 37, r.totalValue, "num") +
      cellXml("D", rowNum, 23, posLabel(r.placeOfSupply)) +
      cellXml("E", rowNum, 69, "") +
      cellXml("F", rowNum, 37, r2(r.igstRate), "num") +
      cellXml("G", rowNum, 37, r.taxableValue, "num") +
      cellXml("H", rowNum, 37, r2(r.cessAmount), "num") +
      cellXml("I", rowNum, 18, r.ecoGstin ? ensureTcsGstin(r.ecoGstin) : "") +
      `</row>`
    );
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
    .filter(
      (r) => (r.invoiceType === "B2CS" || r.invoiceType === "CDNCS") && Boolean(r.placeOfSupply)
    )
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
    return (
      `<row r="${rowNum}" spans="1:8" s="19" customFormat="1">` +
      cellXml("A", rowNum, 26, "OE") +
      cellXml("B", rowNum, 20, posLabel(v.pos)) +
      cellXml("C", rowNum, 69, "") +
      cellXml("D", rowNum, 37, v.rt, "num") +
      cellXml("E", rowNum, 253, v.txval, "num") +
      cellXml("F", rowNum, 37, "") +
      cellXml("G", rowNum, 253, "") +
      cellXml("H", rowNum, 25, "") +
      `</row>`
    );
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
    return (
      `<row r="${rowNum}" spans="1:13" s="19" customFormat="1">` +
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
      cellXml("M", rowNum, 37, r2(Math.abs(r.cessAmount)), "num") +
      `</row>`
    );
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
  const cdnurRows = validRows.filter((r) => r.invoiceType === "CDNCS" && r.totalValue > 250000);
  const cdnurNotes = cdnurRows.length;
  const cdnurTotalVal = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.totalValue), 0));
  const cdnurTotalTxVal = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.taxableValue), 0));
  const cdnurTotalCess = r2(cdnurRows.reduce((s, r) => s + Math.abs(r.cessAmount), 0));

  const cdnurDataRowsXml = cdnurRows.map((r, idx) => {
    const rowNum = 5 + idx;
    const rate = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
    return (
      `<row r="${rowNum}" spans="1:10" s="19" customFormat="1">` +
      cellXml("A", rowNum, 23, "B2CL") +
      cellXml("B", rowNum, 18, r.invoiceNumber) +
      cellXml("C", rowNum, 23, toExcelDate(r.invoiceDate)) +
      cellXml("D", rowNum, 23, "C") +
      cellXml("E", rowNum, 23, posLabel(r.placeOfSupply)) +
      cellXml("F", rowNum, 37, Math.abs(r.totalValue), "num") +
      cellXml("G", rowNum, 69, "") +
      cellXml("H", rowNum, 37, rate, "num") +
      cellXml("I", rowNum, 37, Math.abs(r.taxableValue), "num") +
      cellXml("J", rowNum, 37, r2(Math.abs(r.cessAmount)), "num") +
      `</row>`
    );
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
    return (
      `<row r="${rowNum}" spans="1:10" s="19" customFormat="1">` +
      cellXml("A", rowNum, 23, r.exportType || "WOPAY") +
      cellXml("B", rowNum, 18, r.invoiceNumber) +
      cellXml("C", rowNum, 23, toExcelDate(r.invoiceDate)) +
      cellXml("D", rowNum, 37, r.totalValue, "num") +
      cellXml("E", rowNum, 69, r.portCode || "") +
      cellXml("F", rowNum, 70, r.shippingBillNumber || "") +
      cellXml("G", rowNum, 23, toExcelDate(r.shippingBillDate || "")) +
      cellXml("H", rowNum, 37, r2(r.igstRate), "num") +
      cellXml("I", rowNum, 37, r.taxableValue, "num") +
      cellXml("J", rowNum, 37, r2(r.cessAmount), "num") +
      `</row>`
    );
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
    const hsn = normalizeHsn(r.hsnCode);
    // An all-zero or absent code is not a classification. Emitting it puts a
    // row on the portal that will be rejected; leaving it out keeps Table 12
    // honest about what was actually classified.
    if (!hsn) continue;

    const isB2B = r.invoiceType === "B2B" || r.invoiceType === "CDNR";
    const targetMap = isB2B ? hsnB2bAgg : hsnB2cAgg;

    const rt = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
    const uqc = r.uqc || "PCS";
    const key = `${hsn}|${rt}|${uqc}`;

    if (!targetMap.has(key)) {
      targetMap.set(key, {
        hsn,
        desc: hsnDescription(r.itemDescription),
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
    if (!b.desc) b.desc = hsnDescription(r.itemDescription);
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
    return (
      `<row r="${rowNum}" spans="1:11" s="19" customFormat="1">` +
      cellXml("A", rowNum, 69, v.hsn) +
      cellXml("B", rowNum, 18, v.desc) +
      cellXml("C", rowNum, 18, toUqcFull(v.uqc)) +
      cellXml("D", rowNum, 38, v.qty, "num") +
      cellXml("E", rowNum, 38, v.totalVal, "num") +
      cellXml("F", rowNum, 38, v.rt, "num") +
      cellXml("G", rowNum, 38, v.txval, "num") +
      cellXml("H", rowNum, 38, v.iamt, "num") +
      cellXml("I", rowNum, 38, v.camt, "num") +
      cellXml("J", rowNum, 38, v.samt, "num") +
      cellXml("K", rowNum, 38, v.csamt, "num") +
      `</row>`
    );
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
    return (
      `<row r="${rowNum}" spans="1:11" s="19" customFormat="1">` +
      cellXml("A", rowNum, 69, v.hsn) +
      cellXml("B", rowNum, 18, v.desc) +
      cellXml("C", rowNum, 18, toUqcFull(v.uqc)) +
      cellXml("D", rowNum, 38, v.qty, "num") +
      cellXml("E", rowNum, 38, v.totalVal, "num") +
      cellXml("F", rowNum, 38, v.rt, "num") +
      cellXml("G", rowNum, 38, v.txval, "num") +
      cellXml("H", rowNum, 38, v.iamt, "num") +
      cellXml("I", rowNum, 38, v.camt, "num") +
      cellXml("J", rowNum, 38, v.samt, "num") +
      cellXml("K", rowNum, 38, v.csamt, "num") +
      `</row>`
    );
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
  // Table 13 reports each document *series* separately. Grouping only by
  // document type collapsed unrelated series into one row and printed a range
  // spanning both — "2026-2027/57 to IN-1026" describes no series that exists,
  // and a marketplace order id turned up as the first credit note. The series
  // stem (everything before the trailing number) is what separates them.
  /** Separates document type from series in a group key. Neither contains it. */
  const SERIES_KEY_SEP = "::";

  const invoiceGroups = new Map<string, string[]>();
  validRows.forEach((r) => {
    const number = r.invoiceNumber?.trim();
    if (!number) return;

    const isCreditNote = r.invoiceType === "CDNR" || r.invoiceType === "CDNCS";
    const docType = isCreditNote ? "Credit Note" : "Invoices for outward supply";
    invoiceGroups.set(
      `${docType}${SERIES_KEY_SEP}${documentSeries(number)}`,
      (invoiceGroups.get(`${docType}${SERIES_KEY_SEP}${documentSeries(number)}`) ?? []).concat(
        number
      )
    );
  });

  // Fold the one-off, letterless stems back together per document type, so a
  // thousand marketplace order ids report as one block rather than a thousand
  // single-document "series".
  for (const [key, numbers] of Array.from(invoiceGroups.entries())) {
    const sepAt = key.indexOf(SERIES_KEY_SEP);
    const docType = key.slice(0, sepAt);
    const stem = key.slice(sepAt + SERIES_KEY_SEP.length);
    if (isRealSeries(stem, new Set(numbers).size)) continue;

    const bucket = `${docType}${SERIES_KEY_SEP}#`;
    invoiceGroups.set(bucket, (invoiceGroups.get(bucket) ?? []).concat(numbers));
    invoiceGroups.delete(key);
  }

  const docRowsData: {
    name: string;
    from: string;
    to: string;
    totnum: number;
    cancel: number;
  }[] = [];

  invoiceGroups.forEach((invNumbers, key) => {
    if (invNumbers.length === 0) return;

    const uniqueInvoices = Array.from(new Set(invNumbers));
    uniqueInvoices.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    // The key carries the series so rows stay separate; only the document type
    // belongs in the sheet's "Nature of Document" column.
    docRowsData.push({
      name: key.slice(0, key.indexOf(SERIES_KEY_SEP)),
      from: uniqueInvoices[0]!,
      to: uniqueInvoices[uniqueInvoices.length - 1]!,
      totnum: uniqueInvoices.length,
      // Cancellations are not derivable from the marketplace exports we read —
      // a cancelled invoice simply never appears. Reporting 0 states what we
      // know rather than implying we checked.
      cancel: 0,
    });
  });

  // Invoices first, then credit notes — the order Table 13 is read in, and the
  // one the CA's return uses. Alphabetical would put credit notes on top.
  const DOC_TYPE_ORDER = ["Invoices for outward supply", "Credit Note"];
  docRowsData.sort(
    (a, b) =>
      DOC_TYPE_ORDER.indexOf(a.name) - DOC_TYPE_ORDER.indexOf(b.name) ||
      a.from.localeCompare(b.from, undefined, { numeric: true })
  );

  const docsTotalNum = docRowsData.reduce((s, d) => s + d.totnum, 0);
  const docsTotalCancel = docRowsData.reduce((s, d) => s + d.cancel, 0);

  const docsDataRowsXml = docRowsData.map((d, idx) => {
    const rowNum = 5 + idx;
    return (
      `<row r="${rowNum}" spans="1:5" s="19" customFormat="1">` +
      cellXml("A", rowNum, 18, d.name) +
      cellXml("B", rowNum, 18, d.from) +
      cellXml("C", rowNum, 18, d.to) +
      cellXml("D", rowNum, 50, d.totnum, "num") +
      cellXml("E", rowNum, 103, d.cancel, "num") +
      `</row>`
    );
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
    .filter(
      (r) => !isStockTransferRow(r) && r.sourcePlatformId !== "offline" && Boolean(r.ecoGstin)
    )
    .forEach((r) => {
      const etin = ensureTcsGstin(r.ecoGstin!);
      const isCreditNote = r.invoiceType === "CDNR" || r.invoiceType === "CDNCS";
      const sign = isCreditNote ? -1 : 1;
      if (!ecoAgg.has(etin)) {
        ecoAgg.set(etin, {
          ecoName: r.ecoName || "",
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        });
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
    return (
      `<row r="${rowNum}" spans="1:8">` +
      cellXml("A", rowNum, 211, "Liable to collect tax u/s 52(TCS)") +
      cellXml("B", rowNum, 255, etin) +
      cellXml("C", rowNum, 215, v.ecoName) +
      cellXml("D", rowNum, 199, v.txval, "num") +
      cellXml("E", rowNum, 199, v.iamt, "num") +
      cellXml("F", rowNum, 199, v.camt, "num") +
      cellXml("G", rowNum, 199, v.samt, "num") +
      cellXml("H", rowNum, 199, v.csamt, "num") +
      `</row>`
    );
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
