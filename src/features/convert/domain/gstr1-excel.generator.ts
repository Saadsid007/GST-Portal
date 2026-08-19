/**
 * GSTR-1 Excel Generator
 * Produces multi-sheet Excel matching the official GSTN Offline Tool template v2.1.
 * Includes all 32 worksheets matching the official CA workbook template.
 */

import * as XLSX from "xlsx";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import { getStateName } from "./state-codes";
import { ensureTcsGstin } from "@/features/convert/config/eco-registry";

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

type SheetData = (string | number | null | undefined)[][];

function arrayToSheet(data: SheetData): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(data);
}

function posLabel(code: string): string {
  return `${code}-${getStateName(code)}`;
}

export function generateGstr1Excel(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  _period: string,
  _watermark = false
): Uint8Array {
  const validRows = rows.filter((r) => r.errors.length === 0);
  const supplierState = gstin ? gstin.substring(0, 2) : "";
  const workbook = XLSX.utils.book_new();

  const addSheetWithData = (sheetName: string, sheetData: SheetData) => {
    XLSX.utils.book_append_sheet(workbook, arrayToSheet(sheetData), sheetName);
  };

  // 1. Help Instruction (placeholder)
  addSheetWithData("Help Instruction", [
    ["Invoice & other data upload for creation of GSTR 1"],
    ["Introduction to Excel based template for data upload in Java offline tool"],
  ]);

  // 2. b2b,sez,de Sheet
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
      "", // Receiver Name is left blank in official template
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
  addSheetWithData("b2b,sez,de", b2bSheet);

  // 3. b2ba
  addSheetWithData("b2ba", [
    [
      "Summary For B2BA",
      "Original details ",
      null,
      null,
      "Revised Details ",
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
      null,
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
    [0, null, 0, null, null, null, 0, null, null, null, null, null, 0, 0, 0],
    [
      "GSTIN/UIN of Recipient",
      "Receiver Name",
      "Original Invoice Number",
      "Original Invoice date",
      "Revised Invoice Number",
      "Revised Invoice date",
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
  ]);

  // 4. b2cl
  addSheetWithData("b2cl", [
    ["Summary For B2CL(5)", null, null, null, null, null, null, null, "HELP"],
    ["No. of Invoices"],
    [0, null, 0, null, null, null, 0, 0],
    [
      "Invoice Number",
      "Invoice date",
      "Invoice Value",
      "Place Of Supply",
      "Applicable % of Tax Rate",
      "Rate",
      "Taxable Value",
      "Cess Amount",
      "E-Commerce GSTIN",
    ],
  ]);

  // 5. b2cla
  addSheetWithData("b2cla", [
    [
      "Summary For B2CLA",
      "Original details ",
      null,
      null,
      "Revised Details ",
      null,
      null,
      null,
      null,
      null,
      "HELP",
    ],
    [
      "No. of Invoices",
      null,
      null,
      null,
      null,
      "Total Inv Value",
      null,
      null,
      "Total Taxable Value",
      "Total Cess",
    ],
    [0, null, null, null, null, 0, null, null, 0, 0],
    [
      "Original Invoice Number",
      "Original Invoice date",
      "Original Place Of Supply",
      "Revised Invoice Number",
      "Revised Invoice date",
      "Invoice Value",
      "Applicable % of Tax Rate",
      "Rate",
      "Taxable Value",
      "Cess Amount",
      "E-Commerce GSTIN",
    ],
  ]);

  // 6. b2cs Sheet
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
  const b2csValues = Array.from(b2csAgg.values());
  const b2csTotalTxVal = r2(b2csValues.reduce((s, v) => s + v.txval, 0));

  const b2csSheet: SheetData = [
    ["Summary For B2CS(7)", null, null, null, null, null, "HELP"],
    [null, null, null, null, "Total Taxable  Value", "Total Cess"],
    [null, null, null, null, b2csTotalTxVal, 0],
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
      "", // Blank in official template (Table 14 handles ECO)
    ]),
  ];
  addSheetWithData("b2cs", b2csSheet);

  // 7. b2csa
  addSheetWithData("b2csa", [
    [
      "Summary For B2CSA",
      "Original details ",
      "Revised details",
      null,
      null,
      null,
      null,
      null,
      "HELP",
    ],
    [null, null, null, null, null, null, "Total Taxable  Value", "Total Cess"],
    [null, null, null, null, null, null, 0, 0],
    [
      "Financial Year",
      "Original Month",
      "Place Of Supply",
      "Type",
      "Applicable % of Tax Rate",
      "Rate",
      "Taxable Value",
      "Cess Amount",
      "E-Commerce GSTIN",
    ],
  ]);

  // 8. cdnr Sheet (B2B Credit Notes)
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
      "", // Blank Receiver Name in CA template
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
  addSheetWithData("cdnr", cdnrSheet);

  // 9. cdnra
  addSheetWithData("cdnra", [
    [
      "Summary For CDNRA",
      "Original details ",
      null,
      null,
      "Revised details",
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
      "No. of Notes/Vouchers",
      null,
      null,
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
    [0, null, 0, null, null, null, null, null, null, null, 0, null, null, 0, 0],
    [
      "GSTIN/UIN of Recipient",
      "Receiver Name",
      "Original Note Number",
      "Original Note Date",
      "Revised Note Number",
      "Revised Note Date",
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
  ]);

  // 10. cdnur Sheet (B2C Large & Export Credit Notes - Empty for B2C Small)
  const cdnurRows: NormalizedInvoiceRow[] = [];
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
  addSheetWithData("cdnur", cdnurSheet);

  // 11. cdnura
  addSheetWithData("cdnura", [
    [
      "Summary For CDNURA",
      "Original details ",
      null,
      "Revised details",
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
      null,
      "No. of Notes/Vouchers",
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
    [null, 0, null, null, null, null, null, 0, null, null, 0, 0],
    [
      "UR Type",
      "Original Note Number",
      "Original Note Date",
      "Revised Note Number",
      "Revised Note Date",
      "Note Type",
      "Place Of Supply",
      "Note Value",
      "Applicable % of Tax Rate",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
  ]);

  // 12. exp
  addSheetWithData("exp", [
    ["Summary For EXP(6)", null, null, null, null, null, null, null, null, "HELP"],
    [
      null,
      "No. of Invoices",
      null,
      "Total Invoice Value",
      null,
      "No. of Shipping Bill",
      null,
      null,
      null,
      "Total Taxable Value",
    ],
    [null, 0, null, 0, null, 0, null, null, null, 0],
    [
      "Export Type",
      "Invoice Number",
      "Invoice date",
      "Invoice Value",
      "Port Code",
      "Shipping Bill Number",
      "Shipping Bill Date",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
  ]);

  // 13. expa
  addSheetWithData("expa", [
    [
      "Summary For EXPA",
      "Original details ",
      null,
      "Revised details",
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
      null,
      "No. of Invoices",
      null,
      null,
      null,
      "Total Invoice Value",
      null,
      "No. of Shipping Bill",
      null,
      null,
      "Total Taxable Value",
      "Total Cess",
    ],
    [null, 0, null, null, null, 0, null, 0, null, null, 0, 0],
    [
      "Export Type",
      "Original Invoice Number",
      "Original Invoice date",
      "Revised Invoice Number",
      "Revised Invoice date",
      "Invoice Value",
      "Port Code",
      "Shipping Bill Number",
      "Shipping Bill Date",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
  ]);

  // 14. at
  addSheetWithData("at", [
    ["Summary For Advance Received (11B) ", null, null, null, "HELP"],
    [null, null, null, "Total Advance Received", "Total Cess"],
    [null, null, null, 0, 0],
    [
      "Place Of Supply",
      "Applicable % of Tax Rate",
      "Rate",
      "Gross Advance Received",
      "Cess Amount",
    ],
  ]);

  // 15. ata
  addSheetWithData("ata", [
    [
      "Summary For Amended Tax Liability(Advance Received) ",
      "Original details ",
      null,
      "Revised details",
      null,
      null,
      "HELP",
    ],
    [null, null, null, null, null, "Total Advance Received", "Total Cess"],
    [null, null, null, null, null, 0, 0],
    [
      "Financial Year",
      "Original Month",
      "Original Place Of Supply",
      "Applicable % of Tax Rate",
      "Rate",
      "Gross Advance Received",
      "Cess Amount",
    ],
  ]);

  // 16. atadj
  addSheetWithData("atadj", [
    ["Summary For Advance Adjusted (11B) ", null, null, null, "HELP"],
    [null, null, null, "Total Advance Adjusted", "Total Cess"],
    [null, null, null, 0, 0],
    [
      "Place Of Supply",
      "Applicable % of Tax Rate",
      "Rate",
      "Gross Advance Adjusted",
      "Cess Amount",
    ],
  ]);

  // 17. atadja
  addSheetWithData("atadja", [
    [
      "Summary For Amendement Of Adjustment Advances",
      "Original details ",
      null,
      "Revised details",
      null,
      null,
      "HELP",
    ],
    [null, null, null, null, null, "Total Advance Adjusted", "Total Cess"],
    [null, null, null, null, null, 0, 0],
    [
      "Financial Year",
      "Original Month",
      "Original Place Of Supply",
      "Applicable % of Tax Rate",
      "Rate",
      "Gross Advance Adjusted",
      "Cess Amount",
    ],
  ]);

  // 18. exemp
  addSheetWithData("exemp", [
    ["Summary For Nil rated, exempted and non GST outward supplies (8)", null, null, "HELP"],
    [null, "Total Nil Rated Supplies", "Total Exempted Supplies", "Total Non-GST Supplies"],
    [null, 0, 0, 0],
    [
      "Description",
      "Nil Rated Supplies",
      "Exempted(other than nil rated/non GST supply)",
      "Non-GST Supplies",
    ],
    ["Intra-State supplies to registered persons"],
    ["Inter-State supplies to registered persons"],
    ["Intra-State supplies to unregistered persons"],
    ["Inter-State supplies to unregistered persons"],
  ]);

  const isStockTransferRow = (r: NormalizedInvoiceRow) =>
    r.sourcePlatformId === "amazon_stock_transfer" ||
    (r.transactionType as string) === "FC_TRANSFER" ||
    (r.transactionType as string) === "FC_REMOVAL" ||
    /-(T|D)-\d+$/i.test(r.invoiceNumber);

  // 19. hsn(b2b) Sheet
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
        "", // Blank description in CA template
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

  const hsnB2bMap = buildHsnMap(
    (r) => (r.invoiceType === "B2B" || r.invoiceType === "CDNR") && !isStockTransferRow(r)
  );
  const _hsnB2cMap = buildHsnMap(
    (r) =>
      (r.invoiceType === "B2CS" || r.invoiceType === "B2CL" || r.invoiceType === "CDNCS") &&
      !isStockTransferRow(r)
  );

  addSheetWithData("hsn(b2b)", buildHsnSheet(hsnB2bMap));

  // 20. hsn(b2c) Sheet — In CA template, B2C HSN summary is kept empty
  addSheetWithData("hsn(b2c)", [
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
    [0, null, null, null, 0, null, 0, 0, 0, 0, 0],
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
  ]);

  // 21. docs Sheet
  // 21. docs Sheet
  // Table 13 reports serial ranges of tax invoices and credit notes issued.
  // Marketplace sub-orders or numbers with underscores (e.g. Meesho sub_order_num) are excluded.
  const isEligibleDocInvoice = (r: NormalizedInvoiceRow): boolean => {
    if (isStockTransferRow(r)) return false;
    if (r.sourcePlatformId === "meesho") return false;
    const inv = r.invoiceNumber.trim();
    return /^[a-zA-Z0-9\-\/]{1,16}$/.test(inv);
  };

  const invoiceDocs = validRows.filter(
    (r) => r.invoiceType !== "CDNR" && r.invoiceType !== "CDNCS" && isEligibleDocInvoice(r)
  );
  const noteDocs = validRows.filter(
    (r) => (r.invoiceType === "CDNR" || r.invoiceType === "CDNCS") && isEligibleDocInvoice(r)
  );

  type DocSeriesEntry = {
    nature: string;
    from: string;
    to: string;
    totnum: number;
    cancel: number;
  };

  const buildDocSeries = (nature: string, list: NormalizedInvoiceRow[]): DocSeriesEntry[] => {
    if (list.length === 0) return [];

    const prefixGroups = new Map<string, string[]>();
    for (const r of list) {
      const inv = r.invoiceNumber.trim();
      const lastSlash = inv.lastIndexOf("/");
      const lastDash = inv.lastIndexOf("-");
      let prefix = inv;
      if (lastSlash > 0) {
        prefix = inv.substring(0, lastSlash);
      } else if (lastDash > 0) {
        prefix = inv.substring(0, lastDash);
      } else {
        const matchLetter = inv.match(/^[A-Za-z0-9]*[A-Za-z]+/);
        if (matchLetter) prefix = matchLetter[0];
      }
      if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, []);
      prefixGroups.get(prefix)!.push(inv);
    }

    const series: DocSeriesEntry[] = [];
    for (const [prefix, invoices] of prefixGroups) {
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
      let totnum = lastNum >= firstNum && firstNum > 0 ? lastNum - firstNum + 1 : actualCount;
      let cancel = Math.max(0, totnum - actualCount);

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
  addSheetWithData("docs", docsSheet);

  // 22. eco Sheet (Table 14a — Supplies made through ECO)
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
      "", // Blank operator name in CA template
      v.txval,
      v.iamt,
      v.camt,
      v.samt,
      v.csamt || undefined,
    ]),
  ];
  addSheetWithData("eco", ecoSheet);

  // 23-32. Remaining 10 placeholder sheets matching CA template exactly
  addSheetWithData("ecoa", [
    [
      "Summary For Amended Supplies through ECO-14A",
      "Original details ",
      null,
      "Revised details",
      null,
      null,
      null,
      null,
      null,
      null,
      "HELP",
    ],
    [
      null,
      null,
      null,
      "No. of E-Commerce Operator",
      null,
      null,
      "Total Net Value of Supplies",
      "Total Integrated Tax",
      "Total Central Tax ",
      "Total State/UT Tax ",
      "Total Cess",
    ],
    [null, null, null, 0, null, null, 0, 0, 0, 0, 0],
    [
      "Nature of Supply",
      "Financial Year",
      "Original Month/Quarter",
      "Original GSTIN of E-Commerce Operator",
      "Revised GSTIN of E-Commerce Operator",
      "E-Commerce Operator Name",
      "Revised Net value of supplies",
      "Integrated tax",
      "Central tax",
      "State/UT tax",
      "Cess",
    ],
  ]);

  addSheetWithData("ecob2b", [
    [
      "Summary For Supplies U/s 9(5)-15-B2B",
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
      "No. of Supplier",
      null,
      "No. of Recipients",
      null,
      "No. of Documents",
      null,
      "Total value of supplies made",
      null,
      null,
      null,
      "Total Taxable Value",
      "Total Cess",
    ],
    [0, null, 0, null, 0, null, 0, null, null, null, 0, 0],
    [
      "Supplier GSTIN/UIN",
      "Supplier Name",
      "Recipient GSTIN/UIN",
      "Recipient Name",
      "Document Number",
      "Document Date",
      "Value of supplies made",
      "Place Of Supply",
      "Document type",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
  ]);

  addSheetWithData("ecourp2b", [
    [
      "Summary For Supplies U/s 9(5)-15-URP2B",
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
      "No. of Documents",
      null,
      "Total value of supplies made",
      null,
      null,
      null,
      "Total Taxable Value",
      "Total Cess",
    ],
    [0, null, 0, null, 0, null, null, null, 0, 0],
    [
      "Recipient GSTIN/UIN",
      "Recipient Name",
      "Document Number",
      "Document Date",
      "Value of supplies made",
      "Place Of Supply",
      "Document type",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
  ]);

  addSheetWithData("ecob2c", [
    ["Summary For Supplies U/s 9(5)-15-B2C", null, null, null, null, "HELP"],
    ["No. of Supplier", null, null, "Total Taxable Value", null, "Total Cess"],
    [0, null, null, 0, null, 0],
    [
      "Supplier GSTIN/UIN",
      "Supplier Name",
      "Place Of Supply",
      "Taxable Value",
      "Rate",
      "Cess Amount",
    ],
  ]);

  addSheetWithData("ecourp2c", [
    ["Summary For Supplies U/s 9(5)-15-URP2C", null, null, "HELP"],
    [null, "Total Taxable Value", null, "Total Cess"],
    [null, 0, null, 0],
    ["Place Of Supply", "Taxable Value", "Rate", "Cess Amount"],
  ]);

  addSheetWithData("ecoab2b", [
    [
      "Summary For Supplies U/s 9(5) - 15A-B2B",
      "Original details ",
      null,
      null,
      null,
      null,
      "Revised details ",
      null,
      null,
      null,
      null,
      null,
      null,
      "HELP",
    ],
    [
      "No. of Supplier",
      null,
      "No. of Recipients",
      null,
      "No. of Documents",
      null,
      null,
      null,
      "Total value of supplies made",
      null,
      null,
      null,
      "Total Taxable Value",
      "Total Cess",
    ],
    [0, null, 0, null, 0, null, null, null, 0, null, null, null, 0, 0],
    [
      "Supplier GSTIN/UIN",
      "Supplier Name",
      "Recipient GSTIN/UIN",
      "Recipient Name",
      "Original Document Number",
      "Original Document Date",
      "Revised Document Number",
      "Revised Document Date",
      "Value of supplies made",
      "Place Of Supply",
      "Document type",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
  ]);

  addSheetWithData("ecoab2c", [
    [
      "Summary For Supplies U/s 9(5)-15A-B2C",
      "Original details ",
      null,
      null,
      "Revised details ",
      null,
      null,
      "HELP",
    ],
    [null, null, "No. of Supplier", null, null, null, "Total Taxable Value", "Total Cess"],
    [null, null, 0, null, null, null, 0, 0],
    [
      "Financial Year",
      "Original Month",
      "Supplier GSTIN/UIN",
      "Supplier Name",
      "Place Of Supply",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
  ]);

  addSheetWithData("ecoaurp2b", [
    [
      "Summary For Supplies U/s 9(5)-15A-URP2B",
      "Original details ",
      null,
      null,
      "Revised details ",
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
      "No. of Documents",
      null,
      null,
      null,
      "Total value of supplies made",
      null,
      null,
      null,
      "Total Taxable Value",
      "Total Cess",
    ],
    [0, null, 0, null, null, null, 0, null, null, null, 0, 0],
    [
      "Recipient GSTIN/UIN",
      "Recipient Name",
      "Original Document Number",
      "Original Document Date",
      "Revised Document Number",
      "Revised Document Date",
      "Value of supplies made",
      "Document type",
      "Place Of Supply",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
  ]);

  addSheetWithData("ecoaurp2c", [
    [
      "Summary For Supplies U/s 9(5)-15A-URP2C",
      "Original details ",
      "Revised details ",
      null,
      null,
      "HELP",
    ],
    [null, null, null, null, "Total Taxable Value", "Total Cess"],
    [null, null, null, null, 0, 0],
    ["Financial Year", "Original Month", "Place Of Supply", "Rate", "Taxable Value", "Cess Amount"],
  ]);

  // Master sheet dropdown reference data
  addSheetWithData("master", [
    [
      "UQC",
      "Export Type",
      "Reverse Charge/Provisional Assessment",
      "Note Type",
      "Type",
      "Tax Rate",
      "POS",
      "Invoice Type",
      "Nature  of Document",
      "UR Type",
      "Supply Type ",
      "Month",
      "Financial Year",
      "Differential Percentage",
      "POS96",
      "Nature of Supply",
    ],
    [
      "BAG-BAGS",
      "WOPAY",
      "N",
      "C",
      "OE",
      0,
      "01-Jammu & Kashmir",
      "Regular B2B",
      "Invoices for outward supply",
      "B2CL",
      "Inter State",
      "JANUARY",
      "2017-18",
      null,
      "01-Jammu & Kashmir",
      "Liable to collect tax u/s 52(TCS)",
    ],
    [
      "BAL-BALE",
      "WPAY",
      "Y",
      "D",
      "E",
      0.1,
      "02-Himachal Pradesh",
      "SEZ supplies with payment",
      "Invoices for inward supply from unregistered person",
      "EXPWP",
      "Intra State",
      "FEBRUARY",
      "2018-19",
      "65.00",
      "02-Himachal Pradesh",
      "Liable to pay tax u/s 9(5)",
    ],
  ]);

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Uint8Array;
}
