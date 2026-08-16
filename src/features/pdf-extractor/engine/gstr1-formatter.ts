import * as XLSX from "xlsx";
import type {
  ExtractedInvoice,
  ExtractedHsnRow,
  ExtractedB2csRow,
  PdfExtractionBatchResult,
} from "../domain/types";
import { STATE_CODES } from "@/features/convert/domain/state-codes";

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatGstr1BatchResult(invoices: ExtractedInvoice[]): PdfExtractionBatchResult {
  let totalTaxableValue = 0;
  let totalIgstAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  let totalCessAmount = 0;
  let totalGrossAmount = 0;
  let b2bCount = 0;
  let b2cCount = 0;

  // Aggregate HSN
  const hsnMap = new Map<string, ExtractedHsnRow>();

  // Aggregate B2CS (by State + Rate)
  const b2csMap = new Map<string, ExtractedB2csRow>();

  for (const inv of invoices) {
    totalTaxableValue = r2(totalTaxableValue + inv.taxableValue);
    totalIgstAmount = r2(totalIgstAmount + inv.igstAmount);
    totalCgstAmount = r2(totalCgstAmount + inv.cgstAmount);
    totalSgstAmount = r2(totalSgstAmount + inv.sgstAmount);
    totalCessAmount = r2(totalCessAmount + inv.cessAmount);
    totalGrossAmount = r2(totalGrossAmount + inv.totalInvoiceValue);

    if (inv.classification === "B2B") {
      b2bCount++;
    } else {
      b2cCount++;
      // B2CS Aggregation
      const posFormatted = inv.placeOfSupply && STATE_CODES[inv.placeOfSupply]
        ? `${inv.placeOfSupply}-${STATE_CODES[inv.placeOfSupply]}`
        : inv.placeOfSupply;
      const key = `${posFormatted}|${inv.gstRate}`;
      if (!b2csMap.has(key)) {
        b2csMap.set(key, {
          type: "OE",
          placeOfSupply: posFormatted,
          applicablePercentage: "",
          rate: inv.gstRate,
          taxableValue: inv.taxableValue,
          cessAmount: inv.cessAmount,
          ecommerceGstin: inv.ecommerceGstin || "",
        });
      } else {
        const existing = b2csMap.get(key)!;
        existing.taxableValue = r2(existing.taxableValue + inv.taxableValue);
        existing.cessAmount = r2(existing.cessAmount + inv.cessAmount);
      }
    }

    // Line items HSN aggregation
    for (const item of inv.lineItems) {
      const hsnKey = `${item.hsnCode}|${item.rate}`;
      if (!hsnMap.has(hsnKey)) {
        hsnMap.set(hsnKey, {
          hsnCode: item.hsnCode || "441990",
          description: item.itemDescription || "General goods",
          uqc: item.uqc || "NOS",
          totalQuantity: item.quantity || 1,
          totalValue: item.totalAmount || inv.totalInvoiceValue,
          rate: item.rate || inv.gstRate,
          taxableValue: item.taxableValue || inv.taxableValue,
          igstAmount: item.igstAmount || inv.igstAmount,
          cgstAmount: item.cgstAmount || inv.cgstAmount,
          sgstAmount: item.sgstAmount || inv.sgstAmount,
          cessAmount: item.cessAmount || inv.cessAmount,
        });
      } else {
        const ex = hsnMap.get(hsnKey)!;
        ex.totalQuantity += item.quantity || 1;
        ex.totalValue = r2(ex.totalValue + (item.totalAmount || inv.totalInvoiceValue));
        ex.taxableValue = r2(ex.taxableValue + (item.taxableValue || inv.taxableValue));
        ex.igstAmount = r2(ex.igstAmount + (item.igstAmount || inv.igstAmount));
        ex.cgstAmount = r2(ex.cgstAmount + (item.cgstAmount || inv.cgstAmount));
        ex.sgstAmount = r2(ex.sgstAmount + (item.sgstAmount || inv.sgstAmount));
        ex.cessAmount = r2(ex.cessAmount + (item.cessAmount || inv.cessAmount));
      }
    }
  }

  const hsnSummary = Array.from(hsnMap.values());
  const b2csSummary = Array.from(b2csMap.values());

  // 1. Format GSTR-1 B2B TSV String
  const b2bInvoices = invoices.filter((i) => i.classification === "B2B");
  const b2bHeaders = [
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
  ];
  const b2bLines = [b2bHeaders.join("\t")];
  for (const b of b2bInvoices) {
    const pos = b.placeOfSupply && STATE_CODES[b.placeOfSupply]
      ? `${b.placeOfSupply}-${STATE_CODES[b.placeOfSupply]}`
      : b.placeOfSupply;
    b2bLines.push(
      [
        b.buyerGstin,
        b.buyerName,
        b.invoiceNumber,
        b.invoiceDate,
        b.totalInvoiceValue.toFixed(2),
        pos,
        b.reverseCharge ? "Y" : "N",
        "",
        "Regular B2B",
        b.ecommerceGstin || "",
        b.gstRate,
        b.taxableValue.toFixed(2),
        b.cessAmount > 0 ? b.cessAmount.toFixed(2) : "",
      ].join("\t")
    );
  }

  // 2. Format GSTR-1 B2CS TSV String
  const b2csHeaders = [
    "Type",
    "Place Of Supply",
    "Applicable % of Tax Rate",
    "Rate",
    "Taxable Value",
    "Cess Amount",
    "E-Commerce GSTIN",
  ];
  const b2csLines = [b2csHeaders.join("\t")];
  for (const s of b2csSummary) {
    b2csLines.push(
      [
        s.type,
        s.placeOfSupply,
        s.applicablePercentage,
        s.rate,
        s.taxableValue.toFixed(2),
        s.cessAmount > 0 ? s.cessAmount.toFixed(2) : "",
        s.ecommerceGstin,
      ].join("\t")
    );
  }

  // 3. Format GSTR-1 HSN TSV String
  const hsnHeaders = [
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
  ];
  const hsnLines = [hsnHeaders.join("\t")];
  for (const h of hsnSummary) {
    hsnLines.push(
      [
        h.hsnCode,
        h.description,
        h.uqc,
        h.totalQuantity,
        h.totalValue.toFixed(2),
        h.rate,
        h.taxableValue.toFixed(2),
        h.igstAmount.toFixed(2),
        h.cgstAmount.toFixed(2),
        h.sgstAmount.toFixed(2),
        h.cessAmount > 0 ? h.cessAmount.toFixed(2) : "",
      ].join("\t")
    );
  }

  // 4. Format Docs TSV String
  const docsHeaders = ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"];
  const docsLines = [docsHeaders.join("\t")];
  if (invoices.length > 0) {
    docsLines.push(
      [
        "Invoices for outward supply",
        invoices[0]?.invoiceNumber || "",
        invoices[invoices.length - 1]?.invoiceNumber || "",
        invoices.length,
        0,
      ].join("\t")
    );
  }

  return {
    invoices,
    hsnSummary,
    b2csSummary,
    totalInvoicesCount: invoices.length,
    b2bCount,
    b2cCount,
    totalTaxableValue,
    totalIgstAmount,
    totalCgstAmount,
    totalSgstAmount,
    totalCessAmount,
    totalGrossAmount,
    formattedGstr1B2bTsv: b2bLines.join("\n"),
    formattedGstr1B2csTsv: b2csLines.join("\n"),
    formattedGstr1HsnTsv: hsnLines.join("\n"),
    formattedGstr1DocsTsv: docsLines.join("\n"),
  };
}

export function generatePdfInvoicesExcel(invoices: ExtractedInvoice[]): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: All Extracted Invoices
  const allRows = invoices.map((inv) => ({
    "File Name": inv.fileName,
    "Invoice Number": inv.invoiceNumber,
    "Invoice Date": inv.invoiceDate,
    "Classification": inv.classification,
    "Document Type": inv.documentType,
    "Buyer GSTIN": inv.buyerGstin,
    "Buyer Name": inv.buyerName,
    "Place of Supply": inv.placeOfSupplyStateName,
    "Taxable Value (Rs)": inv.taxableValue,
    "GST Rate (%)": inv.gstRate,
    "IGST (Rs)": inv.igstAmount,
    "CGST (Rs)": inv.cgstAmount,
    "SGST (Rs)": inv.sgstAmount,
    "Cess (Rs)": inv.cessAmount,
    "Total Invoice Value (Rs)": inv.totalInvoiceValue,
    "Supplier GSTIN": inv.supplierGstin,
    "Supplier Name": inv.supplierName,
  }));
  const wsAll = XLSX.utils.json_to_sheet(allRows);
  XLSX.utils.book_append_sheet(wb, wsAll, "All_Extracted");

  // Sheet 2: B2B Table
  const b2bInvoices = invoices.filter((i) => i.classification === "B2B");
  const b2bRows = b2bInvoices.map((inv) => ({
    "GSTIN/UIN of Recipient": inv.buyerGstin,
    "Receiver Name": inv.buyerName,
    "Invoice Number": inv.invoiceNumber,
    "Invoice date": inv.invoiceDate,
    "Invoice Value": inv.totalInvoiceValue,
    "Place Of Supply": inv.placeOfSupply && STATE_CODES[inv.placeOfSupply]
      ? `${inv.placeOfSupply}-${STATE_CODES[inv.placeOfSupply]}`
      : inv.placeOfSupply,
    "Reverse Charge": inv.reverseCharge ? "Y" : "N",
    "Applicable % of Tax Rate": "",
    "Invoice Type": "Regular B2B",
    "E-Commerce GSTIN": inv.ecommerceGstin || "",
    "Rate": inv.gstRate,
    "Taxable Value": inv.taxableValue,
    "Cess Amount": inv.cessAmount || 0,
  }));
  const wsB2b = XLSX.utils.json_to_sheet(b2bRows);
  XLSX.utils.book_append_sheet(wb, wsB2b, "b2b,sez,de");

  const batch = formatGstr1BatchResult(invoices);

  // Sheet 3: B2CS Table
  const b2csRows = batch.b2csSummary.map((s) => ({
    "Type": s.type,
    "Place Of Supply": s.placeOfSupply,
    "Applicable % of Tax Rate": s.applicablePercentage,
    "Rate": s.rate,
    "Taxable Value": s.taxableValue,
    "Cess Amount": s.cessAmount,
    "E-Commerce GSTIN": s.ecommerceGstin,
  }));
  const wsB2cs = XLSX.utils.json_to_sheet(b2csRows);
  XLSX.utils.book_append_sheet(wb, wsB2cs, "b2cs");

  // Sheet 4: HSN Table
  const hsnRows = batch.hsnSummary.map((h) => ({
    "HSN": h.hsnCode,
    "Description": h.description,
    "UQC": h.uqc,
    "Total Quantity": h.totalQuantity,
    "Total Value": h.totalValue,
    "Rate": h.rate,
    "Taxable Value": h.taxableValue,
    "Integrated Tax Amount": h.igstAmount,
    "Central Tax Amount": h.cgstAmount,
    "State/UT Tax Amount": h.sgstAmount,
    "Cess Amount": h.cessAmount,
  }));
  const wsHsn = XLSX.utils.json_to_sheet(hsnRows);
  XLSX.utils.book_append_sheet(wb, wsHsn, "hsn(b2b)");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buffer);
}
