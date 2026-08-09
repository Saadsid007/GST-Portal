/**
 * GSTR-1 Excel Generator
 * Produces multi-sheet Excel matching the official GSTN Offline Tool template format.
 * Sheets: B2B, B2CL, B2CS, CDNR, HSN, ECO, DOCS, Summary
 */

import * as XLSX from "xlsx";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import { WATERMARK_TEXT } from "@/features/billing/constants/billing.constants";
import { getStateName } from "./state-codes";

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function generateGstr1Excel(
  rows: NormalizedInvoiceRow[],
  gstin: string,
  period: string,
  watermark = false
): Uint8Array {
  const validRows = rows.filter((r) => r.errors.length === 0);
  const workbook = XLSX.utils.book_new();

  // Helper: add a sheet
  function addSheet(name: string, data: Record<string, unknown>[]) {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, ws, name);
  }

  // --- B2B Sheet ---
  const b2bData = validRows
    .filter((r) => r.invoiceType === "B2B")
    .map((r) => ({
      "GSTIN of Recipient": r.buyerGstin,
      "Receiver Name": r.buyerName,
      "Invoice Number": r.invoiceNumber,
      "Invoice date": r.invoiceDate,
      "Invoice Value": r.totalValue,
      "Place Of Supply": `${r.placeOfSupply}-${getStateName(r.placeOfSupply)}`,
      "Reverse Charge": "N",
      "Applicable % of Tax Rate": "",
      "Invoice Type": "Regular B2B",
      "E-Commerce GSTIN": "",
      Rate: r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate),
      "Taxable Value": r.taxableValue,
      "Integrated Tax Amount": r.igstAmount || "",
      "Central Tax Amount": r.cgstAmount || "",
      "State/UT Tax Amount": r.sgstAmount || "",
      "Cess Amount": r.cessAmount || "",
    }));
  addSheet("B2B", b2bData.length > 0 ? b2bData : [{ "GSTIN of Recipient": "" }]);

  // --- B2CL Sheet ---
  const b2clData = validRows
    .filter((r) => r.invoiceType === "B2CL")
    .map((r) => ({
      "Invoice Number": r.invoiceNumber,
      "Invoice date": r.invoiceDate,
      "Invoice Value": r.totalValue,
      "Place Of Supply": `${r.placeOfSupply}-${getStateName(r.placeOfSupply)}`,
      "Applicable % of Tax Rate": "",
      Rate: r.igstRate,
      "Taxable Value": r.taxableValue,
      "Integrated Tax Amount": r.igstAmount,
      "Cess Amount": r.cessAmount || "",
      "E-Commerce GSTIN": "",
    }));
  addSheet("B2CL", b2clData.length > 0 ? b2clData : [{ "Invoice Number": "" }]);

  // --- B2CS Sheet ---
  // Operator is part of the key so marketplace supplies stay separable for Table 14.
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
  const b2csData = Array.from(b2csAgg.values()).map((b) => ({
    Type: "OE",
    "Place Of Supply": `${b.pos}-${getStateName(b.pos)}`,
    "Applicable % of Tax Rate": "",
    Rate: b.rt,
    "Taxable Value": b.txval,
    "Integrated Tax Amount": b.iamt || "",
    "Central Tax Amount": b.camt || "",
    "State/UT Tax Amount": b.samt || "",
    "Cess Amount": "",
    "E-Commerce GSTIN": b.ecoGstin,
  }));
  addSheet("B2CS", b2csData.length > 0 ? b2csData : [{ Type: "" }]);

  // --- CDNR Sheet (B2B Credit Notes) ---
  const cdnrData = validRows
    .filter((r) => r.invoiceType === "CDNR")
    .map((r) => ({
      "GSTIN/UIN of Recipient": r.buyerGstin || "",
      "Receiver Name": r.buyerName,
      "Note Number": r.invoiceNumber,
      "Note Date": r.invoiceDate,
      "Note Type": "C",
      "Place Of Supply": `${r.placeOfSupply}-${getStateName(r.placeOfSupply)}`,
      "Reverse Charge": "N",
      "Note Supply Type": "Regular B2B",
      "Note Value": r.totalValue,
      "Applicable % of Tax Rate": "",
      Rate: r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate),
      "Taxable Value": r.taxableValue,
      "Integrated Tax Amount": r.igstAmount || "",
      "Central Tax Amount": r.cgstAmount || "",
      "State/UT Tax Amount": r.sgstAmount || "",
      "Cess Amount": "",
    }));
  addSheet("CDNR", cdnrData.length > 0 ? cdnrData : [{ "GSTIN/UIN of Recipient": "" }]);

  // --- CDNCS Sheet (B2C Credit Notes → CDNUR in official template) ---
  const cdncsData = validRows
    .filter((r) => r.invoiceType === "CDNCS")
    .map((r) => ({
      "UR Type": "B2CL",
      "Note Number": r.invoiceNumber,
      "Note Date": r.invoiceDate,
      "Note Type": "C",
      "Place Of Supply": `${r.placeOfSupply}-${getStateName(r.placeOfSupply)}`,
      "Note Value": r.totalValue,
      "Applicable % of Tax Rate": "",
      Rate: r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate),
      "Taxable Value": r.taxableValue,
      "Integrated Tax Amount": r.igstAmount || "",
      "Central Tax Amount": r.cgstAmount || "",
      "State/UT Tax Amount": r.sgstAmount || "",
      "Cess Amount": "",
    }));
  addSheet("CDNCS", cdncsData.length > 0 ? cdncsData : [{ "UR Type": "" }]);

  // --- HSN Sheet ---
  // Credit notes carry negative amounts and must reduce the HSN totals. Taking absolute values
  // would add returns to sales, so the HSN sheet would never tie back to B2B + B2CS + CDNR.
  const hsnAgg = new Map<
    string,
    {
      hsn: string;
      desc: string;
      txval: number;
      iamt: number;
      camt: number;
      samt: number;
      qty: number;
      rt: number;
      uqc: string;
    }
  >();
  validRows.forEach((r) => {
    const rt = r2(r.igstRate > 0 ? r.igstRate : r.cgstRate + r.sgstRate);
    // UQC is part of the key because GSTN expects one row per HSN, rate and unit.
    const uqc = r.uqc ?? "OTH";
    const key = `${r.hsnCode}|${rt}|${uqc}`;
    if (!hsnAgg.has(key)) {
      hsnAgg.set(key, {
        hsn: r.hsnCode,
        desc: r.itemDescription ?? "",
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        qty: 0,
        rt,
        uqc,
      });
    }
    const isReturn = r.taxableValue < 0 || r.invoiceType === "CDNR";
    const sign = isReturn ? -1 : 1;
    const b = hsnAgg.get(key)!;
    if (!b.desc && r.itemDescription) b.desc = r.itemDescription;
    b.txval = r2(b.txval + Math.abs(r.taxableValue) * sign);
    b.iamt = r2(b.iamt + Math.abs(r.igstAmount) * sign);
    b.camt = r2(b.camt + Math.abs(r.cgstAmount) * sign);
    b.samt = r2(b.samt + Math.abs(r.sgstAmount) * sign);
    b.qty = r2(b.qty + r.quantity * sign);
  });
  const hsnData = Array.from(hsnAgg.values()).map((val) => ({
    "HSN/SAC": val.hsn,
    Description: val.desc,
    UQC: val.uqc,
    "Total Quantity": val.qty,
    Rate: val.rt,
    "Taxable Value": val.txval,
    "Integrated Tax Amount": val.iamt || "",
    "Central Tax Amount": val.camt || "",
    "State/UT Tax Amount": val.samt || "",
    "Cess Amount": "",
  }));
  addSheet("HSN", hsnData.length > 0 ? hsnData : [{ "HSN/SAC": "" }]);

  // --- ECO Sheet (Table 14a) ---
  const ecoAgg = new Map<
    string,
    { ecoName: string; txval: number; iamt: number; camt: number; samt: number }
  >();
  validRows.forEach((r) => {
    if (!r.ecoGstin) return;
    if (!ecoAgg.has(r.ecoGstin)) {
      ecoAgg.set(r.ecoGstin, { ecoName: r.ecoName ?? "", txval: 0, iamt: 0, camt: 0, samt: 0 });
    }
    const b = ecoAgg.get(r.ecoGstin)!;
    b.txval = r2(b.txval + r.taxableValue);
    b.iamt = r2(b.iamt + r.igstAmount);
    b.camt = r2(b.camt + r.cgstAmount);
    b.samt = r2(b.samt + r.sgstAmount);
  });
  const ecoData = Array.from(ecoAgg.entries()).map(([etin, val]) => ({
    "GSTIN of E-Commerce Operator": etin,
    "Operator Name": val.ecoName,
    "Net Value of Supplies": val.txval,
    "Integrated Tax Amount": val.iamt || "",
    "Central Tax Amount": val.camt || "",
    "State/UT Tax Amount": val.samt || "",
    "Cess Amount": "",
  }));
  addSheet("ECO", ecoData.length > 0 ? ecoData : [{ "GSTIN of E-Commerce Operator": "" }]);

  // --- DOCS Sheet ---
  // GSTR-1 requires the document series actually issued in the period. Invoices and credit
  // notes are separate natures of document and are reported as separate series.
  const invoiceDocs = validRows.filter((r) => r.invoiceType !== "CDNR");
  const noteDocs = validRows.filter((r) => r.invoiceType === "CDNR");
  const docSeries = (nature: string, list: NormalizedInvoiceRow[]) => {
    const numbers = list
      .map((r) => r.invoiceNumber)
      .filter(Boolean)
      .sort();
    return {
      "Nature of Document": nature,
      "Sr. No. From": numbers[0] ?? "",
      "Sr. No. To": numbers[numbers.length - 1] ?? "",
      "Total Number": list.length,
      Cancelled: 0,
      "Net Issued": list.length,
    };
  };
  const docsData = [
    docSeries("Invoices for outward supply", invoiceDocs),
    ...(noteDocs.length > 0 ? [docSeries("Credit Note", noteDocs)] : []),
  ];
  addSheet("DOCS", docsData);

  // --- Summary Sheet ---
  // Credit notes: both CDNR (B2B) and CDNCS (B2C) are separate from sales invoices.
  const creditNotes = validRows.filter(
    (r) => r.invoiceType === "CDNR" || r.invoiceType === "CDNCS"
  );
  const salesRows = validRows.filter((r) => r.invoiceType !== "CDNR" && r.invoiceType !== "CDNCS");
  const sum = (list: NormalizedInvoiceRow[], pick: (r: NormalizedInvoiceRow) => number) =>
    r2(list.reduce((s, r) => s + Math.abs(pick(r)), 0));
  const tax = (r: NormalizedInvoiceRow) => r.cgstAmount + r.sgstAmount + r.igstAmount;

  const grossTaxable = sum(salesRows, (r) => r.taxableValue);
  const returnedTaxable = sum(creditNotes, (r) => r.taxableValue);
  const grossGst = sum(salesRows, tax);
  const reversedGst = sum(creditNotes, tax);

  const summaryData = [
    // Free-trial output is marked at the top of the Summary sheet, where anyone
    // opening the workbook sees it before the figures.
    ...(watermark ? [{ Field: "NOTICE", Value: WATERMARK_TEXT }] : []),
    { Field: "GSTIN", Value: gstin },
    { Field: "Filing Period", Value: period },
    { Field: "Sales Invoices", Value: salesRows.length },
    { Field: "Credit Notes", Value: creditNotes.length },
    { Field: "Total Documents", Value: validRows.length },
    { Field: "B2B", Value: validRows.filter((r) => r.invoiceType === "B2B").length },
    { Field: "B2CL", Value: validRows.filter((r) => r.invoiceType === "B2CL").length },
    { Field: "B2CS", Value: validRows.filter((r) => r.invoiceType === "B2CS").length },
    { Field: "CDNR", Value: creditNotes.length },
    { Field: "Gross Taxable Value", Value: grossTaxable },
    { Field: "Returns (Taxable)", Value: returnedTaxable },
    { Field: "Net Taxable Value", Value: r2(grossTaxable - returnedTaxable) },
    { Field: "Gross GST", Value: grossGst },
    { Field: "GST Reversed", Value: reversedGst },
    { Field: "Net GST", Value: r2(grossGst - reversedGst) },
    { Field: "Net CGST", Value: r2(validRows.reduce((s, r) => s + r.cgstAmount, 0)) },
    { Field: "Net SGST", Value: r2(validRows.reduce((s, r) => s + r.sgstAmount, 0)) },
    { Field: "Net IGST", Value: r2(validRows.reduce((s, r) => s + r.igstAmount, 0)) },
  ];
  addSheet("Summary", summaryData);

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Uint8Array;
}
