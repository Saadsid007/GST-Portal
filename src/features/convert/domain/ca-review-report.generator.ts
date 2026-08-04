/**
 * CA Review Report Generator
 *
 * A styled, human-facing companion to the plain GSTN upload workbook. The GSTN offline tool
 * parses cells positionally and can trip over decorated files, so styling deliberately lives
 * in a separate download rather than being added to the upload file.
 */

import ExcelJS from "exceljs";
import type {
  NormalizedInvoiceRow,
  NetSalesStatement,
} from "@/features/convert/types/convert.types";
import { WATERMARK_TEXT } from "@/features/billing/constants/billing.constants";
import { getStateName } from "./state-codes";

const BRAND = "1F2937";
const BRAND_ACCENT = "0F766E";
const ZEBRA = "F8FAFC";
const CREDIT_TEXT = "B91C1C";
const CURRENCY = '"₹"#,##0.00;[Red]-"₹"#,##0.00';

type Align = "left" | "right" | "center";

interface Column {
  header: string;
  key: string;
  width: number;
  align?: Align;
  /** Rendered as currency and included in the totals row. */
  money?: boolean;
}

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function effectiveRate(row: NormalizedInvoiceRow): number {
  return r2(row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate);
}

function isCredit(row: NormalizedInvoiceRow): boolean {
  return row.invoiceType === "CDNR" || row.taxableValue < 0;
}

/**
 * Writes one presentation-ready sheet: branded header band, frozen header, autofilter,
 * zebra striping, currency formats, and a bold totals row over the money columns.
 */
function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Column[],
  records: Record<string, unknown>[],
  opts: { creditFlags?: boolean[] } = {}
): void {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  const header = sheet.addRow(
    columns.reduce<Record<string, unknown>>((acc, c) => ({ ...acc, [c.key]: c.header }), {})
  );
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND}` } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: `FF${BRAND_ACCENT}` } } };
  });

  records.forEach((record, idx) => {
    const row = sheet.addRow(record);
    const credit = opts.creditFlags?.[idx] ?? false;

    row.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      if (!col) return;

      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ZEBRA}` } };
      }
      // Credit notes are the one row type a reviewer must never mistake for a sale.
      if (credit) cell.font = { color: { argb: `FF${CREDIT_TEXT}` }, italic: true };
      if (col.money) cell.numFmt = CURRENCY;
      cell.alignment = {
        horizontal: col.align ?? (col.money ? "right" : "left"),
        vertical: "middle",
      };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    });
  });

  if (records.length > 0) {
    const totals = sheet.addRow(
      columns.reduce<Record<string, unknown>>((acc, c, i) => {
        if (i === 0) return { ...acc, [c.key]: "TOTAL" };
        if (!c.money) return acc;
        const sum = records.reduce((s, rec) => s + (Number(rec[c.key]) || 0), 0);
        return { ...acc, [c.key]: r2(sum) };
      }, {})
    );
    totals.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      cell.font = { bold: true, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F0EF" } };
      cell.border = { top: { style: "medium", color: { argb: `FF${BRAND_ACCENT}` } } };
      if (col?.money) {
        cell.numFmt = CURRENCY;
        cell.alignment = { horizontal: "right" };
      }
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
}

export async function generateCaReviewReport(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  period: string,
  statement?: NetSalesStatement,
  watermark = false
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GSTPilot";

  const validRows = rows.filter((r) => r.errors.length === 0);
  const excluded = rows.filter((r) => r.errors.length > 0);
  const credits = validRows.filter(isCredit);
  const sales = validRows.filter((r) => !isCredit(r));

  // --- Overview ---
  const overview = workbook.addWorksheet("Overview", { views: [{ state: "frozen", ySplit: 1 }] });
  overview.columns = [
    { key: "field", width: 34 },
    { key: "value", width: 24 },
  ];
  const title = overview.addRow({ field: "GSTR-1 Review Report", value: "" });
  overview.mergeCells(1, 1, 1, 2);
  title.height = 30;
  title.getCell(1).font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  title.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND}` } };
  title.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

  // Free-trial output carries a visible banner directly under the title, so a
  // watermarked report can never be mistaken for a paid one.
  if (watermark) {
    const banner = overview.addRow({ field: WATERMARK_TEXT, value: "" });
    overview.mergeCells(banner.number, 1, banner.number, 2);
    banner.height = 26;
    banner.getCell(1).font = { bold: true, size: 10, color: { argb: `FF${CREDIT_TEXT}` } };
    banner.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    banner.getCell(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }

  const grossTaxable = r2(sales.reduce((s, r) => s + Math.abs(r.taxableValue), 0));
  const returnedTaxable = r2(credits.reduce((s, r) => s + Math.abs(r.taxableValue), 0));
  const taxOf = (r: NormalizedInvoiceRow) =>
    Math.abs(r.cgstAmount) + Math.abs(r.sgstAmount) + Math.abs(r.igstAmount);
  const grossGst = r2(sales.reduce((s, r) => s + taxOf(r), 0));
  const reversedGst = r2(credits.reduce((s, r) => s + taxOf(r), 0));

  const overviewRows: [string, string | number, boolean?][] = [
    ["GSTIN", gstin],
    ["Filing Period", period],
    ["Sales Invoices", sales.length],
    ["Credit Notes", credits.length],
    ["Total Documents", validRows.length],
    ["Rows Excluded (unresolved errors)", excluded.length],
    ["Gross Taxable Value", grossTaxable, true],
    ["Returns (Taxable)", returnedTaxable, true],
    ["Net Taxable Value", r2(grossTaxable - returnedTaxable), true],
    ["Gross GST", grossGst, true],
    ["GST Reversed", reversedGst, true],
    ["Net GST", r2(grossGst - reversedGst), true],
  ];

  for (const [field, value, money] of overviewRows) {
    const row = overview.addRow({ field, value });
    row.getCell(1).font = { bold: true, size: 11 };
    row.getCell(2).alignment = { horizontal: "right" };
    if (money) row.getCell(2).numFmt = CURRENCY;
    // An excluded-row count above zero means the return is incomplete, so it is called out.
    if (field.startsWith("Rows Excluded") && Number(value) > 0) {
      row.getCell(2).font = { bold: true, color: { argb: `FF${CREDIT_TEXT}` } };
    }
    if (field === "Net Taxable Value" || field === "Net GST") {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F0EF" } };
        cell.font = { bold: true, size: 11 };
      });
      row.getCell(2).numFmt = CURRENCY;
      row.getCell(2).alignment = { horizontal: "right" };
    }
  }

  if (statement) {
    overview.addRow({});
    const head = overview.addRow({ field: "Platform Contribution", value: "Net Taxable" });
    head.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_ACCENT}` } };
    });
    for (const p of statement.platformContributions ?? []) {
      const row = overview.addRow({ field: p.platformName, value: p.netTaxable });
      row.getCell(2).numFmt = CURRENCY;
      row.getCell(2).alignment = { horizontal: "right" };
    }
  }

  // --- Invoices ---
  const invoiceColumns: Column[] = [
    { header: "Type", key: "type", width: 9, align: "center" },
    { header: "Platform", key: "platform", width: 13 },
    { header: "Invoice / Note No.", key: "invoice", width: 20 },
    { header: "Date", key: "date", width: 12, align: "center" },
    { header: "Buyer", key: "buyer", width: 24 },
    { header: "Buyer GSTIN", key: "buyerGstin", width: 18 },
    { header: "Place of Supply", key: "pos", width: 20 },
    { header: "HSN", key: "hsn", width: 11, align: "center" },
    { header: "GST %", key: "rate", width: 8, align: "right" },
    { header: "Taxable", key: "taxable", width: 14, money: true },
    { header: "CGST", key: "cgst", width: 12, money: true },
    { header: "SGST", key: "sgst", width: 12, money: true },
    { header: "IGST", key: "igst", width: 12, money: true },
    { header: "Total", key: "total", width: 14, money: true },
    { header: "ECO GSTIN", key: "eco", width: 18 },
  ];

  const ordered = [...sales, ...credits];
  addSheet(
    workbook,
    "Invoices",
    invoiceColumns,
    ordered.map((r) => ({
      type: r.invoiceType,
      platform: r.sourcePlatformName ?? "",
      invoice: r.invoiceNumber,
      date: r.invoiceDate,
      buyer: r.buyerName,
      buyerGstin: r.buyerGstin,
      pos: r.placeOfSupply ? `${r.placeOfSupply}-${getStateName(r.placeOfSupply)}` : "",
      hsn: r.hsnCode,
      rate: effectiveRate(r),
      taxable: r.taxableValue,
      cgst: r.cgstAmount,
      sgst: r.sgstAmount,
      igst: r.igstAmount,
      total: r.totalValue,
      eco: r.ecoGstin ?? "",
    })),
    { creditFlags: ordered.map(isCredit) }
  );

  // --- State Summary ---
  const stateMap = new Map<
    string,
    { taxable: number; cgst: number; sgst: number; igst: number; count: number }
  >();
  for (const r of validRows) {
    if (!stateMap.has(r.placeOfSupply)) {
      stateMap.set(r.placeOfSupply, { taxable: 0, cgst: 0, sgst: 0, igst: 0, count: 0 });
    }
    const b = stateMap.get(r.placeOfSupply)!;
    b.taxable = r2(b.taxable + r.taxableValue);
    b.cgst = r2(b.cgst + r.cgstAmount);
    b.sgst = r2(b.sgst + r.sgstAmount);
    b.igst = r2(b.igst + r.igstAmount);
    b.count += 1;
  }
  addSheet(
    workbook,
    "State Summary",
    [
      { header: "Place of Supply", key: "pos", width: 26 },
      { header: "Documents", key: "count", width: 12, align: "right" },
      { header: "Net Taxable", key: "taxable", width: 15, money: true },
      { header: "CGST", key: "cgst", width: 13, money: true },
      { header: "SGST", key: "sgst", width: 13, money: true },
      { header: "IGST", key: "igst", width: 13, money: true },
    ],
    Array.from(stateMap.entries())
      .sort((a, b) => b[1].taxable - a[1].taxable)
      .map(([pos, v]) => ({
        pos: pos ? `${pos}-${getStateName(pos)}` : "Unknown",
        count: v.count,
        taxable: v.taxable,
        cgst: v.cgst,
        sgst: v.sgst,
        igst: v.igst,
      }))
  );

  // --- HSN Summary ---
  const hsnMap = new Map<
    string,
    {
      hsn: string;
      desc: string;
      uqc: string;
      rate: number;
      qty: number;
      taxable: number;
      tax: number;
    }
  >();
  for (const r of validRows) {
    const rate = effectiveRate(r);
    const uqc = r.uqc ?? "OTH";
    const key = `${r.hsnCode}|${rate}|${uqc}`;
    if (!hsnMap.has(key)) {
      hsnMap.set(key, {
        hsn: r.hsnCode,
        desc: r.itemDescription ?? "",
        uqc,
        rate,
        qty: 0,
        taxable: 0,
        tax: 0,
      });
    }
    const sign = isCredit(r) ? -1 : 1;
    const b = hsnMap.get(key)!;
    if (!b.desc && r.itemDescription) b.desc = r.itemDescription;
    b.qty = r2(b.qty + r.quantity * sign);
    b.taxable = r2(b.taxable + Math.abs(r.taxableValue) * sign);
    b.tax = r2(b.tax + taxOf(r) * sign);
  }
  addSheet(
    workbook,
    "HSN Summary",
    [
      { header: "HSN / SAC", key: "hsn", width: 14 },
      { header: "Description", key: "desc", width: 30 },
      { header: "UQC", key: "uqc", width: 8, align: "center" },
      { header: "GST %", key: "rate", width: 9, align: "right" },
      { header: "Net Quantity", key: "qty", width: 14, align: "right" },
      { header: "Net Taxable", key: "taxable", width: 15, money: true },
      { header: "Net Tax", key: "tax", width: 14, money: true },
    ],
    Array.from(hsnMap.values()).sort((a, b) => b.taxable - a.taxable)
  );

  // --- Table 14 ---
  const ecoMap = new Map<string, { name: string; taxable: number; tax: number; count: number }>();
  for (const r of validRows) {
    if (!r.ecoGstin) continue;
    if (!ecoMap.has(r.ecoGstin))
      ecoMap.set(r.ecoGstin, { name: r.ecoName ?? "", taxable: 0, tax: 0, count: 0 });
    const sign = isCredit(r) ? -1 : 1;
    const b = ecoMap.get(r.ecoGstin)!;
    b.taxable = r2(b.taxable + Math.abs(r.taxableValue) * sign);
    b.tax = r2(b.tax + taxOf(r) * sign);
    b.count += 1;
  }
  if (ecoMap.size > 0) {
    addSheet(
      workbook,
      "Table 14 (ECO)",
      [
        { header: "Operator GSTIN", key: "etin", width: 20 },
        { header: "Operator", key: "name", width: 26 },
        { header: "Documents", key: "count", width: 12, align: "right" },
        { header: "Net Taxable", key: "taxable", width: 15, money: true },
        { header: "Net Tax", key: "tax", width: 14, money: true },
      ],
      Array.from(ecoMap.entries()).map(([etin, v]) => ({
        etin,
        name: v.name,
        count: v.count,
        taxable: v.taxable,
        tax: v.tax,
      }))
    );
  }

  // --- Excluded rows ---
  // Present only when something was dropped, so an empty sheet never implies a problem.
  if (excluded.length > 0) {
    addSheet(
      workbook,
      "Excluded Rows",
      [
        { header: "Source File", key: "file", width: 24 },
        { header: "Row", key: "rowIndex", width: 8, align: "right" },
        { header: "Invoice No.", key: "invoice", width: 20 },
        { header: "Taxable", key: "taxable", width: 14, money: true },
        { header: "Errors", key: "errors", width: 70 },
      ],
      excluded.map((r) => ({
        file: r.sourceFileName ?? "",
        rowIndex: r.rowIndex,
        invoice: r.invoiceNumber,
        taxable: r.taxableValue,
        errors: r.errors.join("; "),
      })),
      { creditFlags: excluded.map(() => true) }
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
