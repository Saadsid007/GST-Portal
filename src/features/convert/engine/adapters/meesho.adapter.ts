import type { AdapterResult, SourceContext } from "./types";
import type {
  NormalizedInvoiceRow,
  InvoiceCategory,
  TransactionType,
} from "@/features/convert/types/convert.types";
import {
  transformStateCode,
  transformDate,
  transformHsn,
} from "@/features/convert/engine/transformation/transformers";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class MeeshoAdapter {
  static adapt(rows: Record<string, string>[], context: SourceContext): AdapterResult {
    const transactions: NormalizedInvoiceRow[] = [];
    const unmappedColumns = new Set<string>();
    let _validRows = 0;
    let _errorRows = 0;

    const isReturnReport =
      context.reportType === "returns" || context.fileName.toLowerCase().includes("return");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];

      // 1. Transaction Type
      const rawTxType = (
        row["transaction_type"] ||
        row["Transaction Type"] ||
        row["Record Type"] ||
        ""
      )
        .trim()
        .toUpperCase();

      let txType: TransactionType = "Sales";
      if (
        isReturnReport ||
        rawTxType === "RETURN" ||
        rawTxType === "REFUND" ||
        Boolean(row["cancel_return_date"])
      ) {
        txType = "Return";
      } else if (rawTxType === "CANCELLED" || rawTxType === "CANCEL") {
        continue;
      }

      // 2. Identities
      // GSTR-1 mandates invoice numbers ≤ 16 characters (GSTN hard limit).
      // Meesho sub_order_num (e.g. "303488396337487040_1") is 18-21 chars.
      //
      // Strategy: keep the item suffix (_1, _2 etc.) intact and fit the
      // numeric part into remaining space. This avoids suffix collisions
      // while satisfying GSTN's 16-char limit.
      //
      // Example: "303488396337487040_1" (20 chars)
      //   suffix = "_1" (2 chars)
      //   numeric tail = last 14 chars of "303488396337487040" = "96337487040_1"
      //   result = "96337487040" + "_1" = 13 chars ✓ ≤ 16
      const rawInvoiceNumber = (
        row["sub_order_num"] ||
        row["sub_order_no"] ||
        row["Invoice Number"] ||
        row["identifier"] ||
        ""
      ).trim();

      let invoiceNumber = rawInvoiceNumber;
      if (rawInvoiceNumber.length > 16) {
        // Split off trailing _N suffix if present (e.g. "_1", "_12")
        const suffixMatch = rawInvoiceNumber.match(/(_\d+)$/);
        const suffix: string = suffixMatch?.[1] ?? "";
        const numericPart = suffix ? rawInvoiceNumber.slice(0, -suffix.length) : rawInvoiceNumber;
        // Take last chars of numeric part to fill up to 16 total
        const maxNumeric = 16 - suffix.length;
        invoiceNumber = numericPart.slice(-maxNumeric) + suffix;
      }

      const rawInvoiceDate = (
        row["order_date"] ||
        row["cancel_return_date"] ||
        row["manifest_date"] ||
        row["Invoice Date"] ||
        ""
      ).trim();

      const invoiceDate = transformDate(rawInvoiceDate) || rawInvoiceDate;

      const buyerGstin = (row["gstin"] || row["Customer GSTIN"] || row["Buyer Gstin"] || "").trim();

      const rawPos = (
        row["end_customer_state_new"] ||
        row["end_customer_state"] ||
        row["End Customer State"] ||
        row["Customer State"] ||
        row["State"] ||
        ""
      ).trim();

      const pos = transformStateCode(rawPos) || rawPos;

      const isB2B = Boolean(buyerGstin);

      let invoiceType: InvoiceCategory = isB2B ? "B2B" : "B2CS";
      if (txType === "Return") {
        invoiceType = "CDNR";
      }

      // 3. Taxable & Tax Values
      let taxableValue = parseFloat(
        row["total_taxable_sale_value"] || row["Taxable Value"] || row["Taxable Amount"] || "0"
      );
      taxableValue = round2(taxableValue);

      let totalTax = parseFloat(
        row["tax_amount"] || row["Tax Amount"] || row["IGST Amount"] || "0"
      );

      const rawIgst = parseFloat(row["IGST Amount"] || row["IGST"] || "0");
      const rawCgst = parseFloat(row["CGST Amount"] || row["CGST"] || "0");
      const rawSgst = parseFloat(row["SGST Amount"] || row["SGST"] || "0");
      const cessAmount = parseFloat(row["CESS Amount"] || row["Cess"] || "0");

      if (!totalTax) {
        totalTax = rawIgst + rawCgst + rawSgst + cessAmount;
      }
      totalTax = round2(totalTax);

      const totalValue = round2(
        parseFloat(
          row["total_invoice_value"] || row["Total Amount"] || row["Invoice Amount"] || "0"
        ) || taxableValue + totalTax
      );

      // 4. Rate
      let gstRate = parseFloat(row["gst_rate"] || row["GST Rate"] || row["Tax Rate"] || "0");
      if (!gstRate && Math.abs(taxableValue) > 0 && Math.abs(totalTax) > 0) {
        gstRate = Math.round((Math.abs(totalTax) / Math.abs(taxableValue)) * 100);
      }

      const validSlabs = [0, 5, 12, 18, 28];
      if (!validSlabs.includes(gstRate)) {
        gstRate = validSlabs.reduce(
          (prev, curr) => (Math.abs(curr - gstRate) < Math.abs(prev - gstRate) ? curr : prev),
          0
        );
      }

      // Determine inter-state vs intra-state.
      // Meesho TCS file has NO separate IGST/CGST/SGST columns.
      // The ONLY reliable signal is: supplier GSTIN state vs customer state (POS).
      // Extract supplier GSTIN from the row itself (Meesho puts it in 'gstin' column).
      const supplierGstin = (
        rows[0]?.["gstin"] ||
        rows[0]?.["Supplier GSTIN"] ||
        context.supplierGstin ||
        ""
      ).trim();
      const supplierStateCode = supplierGstin.substring(0, 2);
      const customerStateCode = pos; // already normalized 2-digit code
      const isInterState =
        supplierStateCode !== "" &&
        customerStateCode !== "" &&
        supplierStateCode !== customerStateCode;

      let igstRate = 0;
      let cgstRate = 0;
      let sgstRate = 0;

      let igstAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;

      if (isInterState) {
        igstRate = gstRate;
        igstAmount = totalTax;
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmount = round2(totalTax / 2);
        sgstAmount = round2(totalTax / 2);
      }

      const cessRate = 0;

      // Returns mapping
      let originalInvoiceNumber = undefined;
      if (txType === "Return") {
        originalInvoiceNumber = row["Original Invoice Number"] || invoiceNumber;
      }

      // Validation
      if (!invoiceNumber) {
        errors.push("Missing Invoice Number");
      }
      if (!invoiceDate) {
        errors.push("Missing Invoice Date");
      }
      if (!pos) {
        errors.push("Missing Place of Supply");
      }

      const tx: NormalizedInvoiceRow = {
        id: crypto.randomUUID(),
        rowIndex: i + 1,
        sourcePlatformId: "meesho",
        sourcePlatformName: "Meesho Supplier Panel",
        sourceFileName: context.fileName,
        sourceFileType: context.reportType,
        transactionType: txType,

        invoiceNumber,
        invoiceDate,
        invoiceType,

        buyerName: row["sup_name"] || "Meesho Customer",
        buyerGstin,
        placeOfSupply: pos,

        itemDescription: row["Product Name"] || row["Item Description"] || "",
        hsnCode: transformHsn(row["hsn_code"] || row["HSN Code"] || row["HSN"]),
        uqc: "NOS",
        quantity: parseInt(row["quantity"] || row["Quantity"] || "1", 10) || 1,

        taxableValue,
        igstAmount,
        cgstAmount,
        sgstAmount,
        cessAmount,
        totalValue,

        igstRate,
        cgstRate,
        sgstRate,
        cessRate,

        ecoGstin: row["eco_tcs_gstin"] || "09AARCM9332R1CM",
        ecoName: "Meesho",

        originalInvoiceNumber,
        errors,
      };

      if (errors.length > 0) {
        _errorRows++;
      } else {
        _validRows++;
      }

      transactions.push(tx);
    }

    // POST-PROCESSING: Consolidate multi-item orders.
    // Some platforms export one row per SKU within the same sub_order_num.
    // GSTR-1 requires one row per invoice — merge rows sharing invoiceNumber + transactionType.
    const invoiceMap = new Map<string, NormalizedInvoiceRow>();
    for (const tx of transactions) {
      const key = `${tx.transactionType}::${tx.invoiceNumber}`;
      const existing = invoiceMap.get(key);
      if (!existing) {
        invoiceMap.set(key, tx);
      } else {
        existing.taxableValue = round2(existing.taxableValue + tx.taxableValue);
        existing.igstAmount = round2(existing.igstAmount + tx.igstAmount);
        existing.cgstAmount = round2(existing.cgstAmount + tx.cgstAmount);
        existing.sgstAmount = round2(existing.sgstAmount + tx.sgstAmount);
        existing.cessAmount = round2(existing.cessAmount + tx.cessAmount);
        existing.totalValue = round2(existing.totalValue + tx.totalValue);
        existing.quantity = (existing.quantity || 1) + (tx.quantity || 1);
      }
    }

    const consolidated = Array.from(invoiceMap.values());
    let finalValidRows = 0;
    let finalErrorRows = 0;
    for (const tx of consolidated) {
      if (tx.errors.length > 0) finalErrorRows++;
      else finalValidRows++;
    }

    return {
      sourceContext: context,
      transactions: consolidated,
      unmappedColumns: Array.from(unmappedColumns),
      totalRows: rows.length,
      validRows: finalValidRows,
      errorRows: finalErrorRows,
    };
  }
}
