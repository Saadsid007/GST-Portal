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
  transformUqc,
} from "@/features/convert/engine/transformation/transformers";
import { resolveEcoGstin } from "@/features/convert/config/eco-registry";

/**
 * Flipkart ships three different shapes, and they are not variants of one
 * layout — they answer different questions:
 *
 *   SELLER_HUB_SALES   the Sales Report tab of the Seller Hub tax export. One
 *                      row per order item, with a real HSN, description and
 *                      quantity. This is the only Flipkart file that can fill
 *                      Table 12 properly.
 *   SELLER_HUB_CREDIT  the Cash Back Report tab: credit and debit notes.
 *   GSTR1_SECTIONS     a workbook already arranged as GSTR-1 sections
 *                      (5B, 7(A)(2), 7(B)(2), 12, 13, GSTR-8 §3). These are
 *                      rate-wise roll-ups, not line items: there is no HSN and
 *                      no per-invoice detail in them at all.
 *
 * The layout is decided by sheet name and then confirmed by columns, because a
 * seller can rename a tab but not the fields Flipkart writes into it.
 */
type Layout = "SELLER_HUB_SALES" | "SELLER_HUB_CREDIT" | "GSTR1_SECTIONS";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function num(value: string | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/[,\s₹]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** First non-empty value among the given column names. */
function pick(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function detectLayout(sheetName: string, columns: string[]): Layout {
  const sheet = sheetName.trim().toLowerCase();
  const has = (needle: string) => columns.some((c) => c.toLowerCase().includes(needle));

  if (sheet.includes("cash back") || has("credit note id")) return "SELLER_HUB_CREDIT";
  if (sheet.includes("sales report") || has("order item id")) return "SELLER_HUB_SALES";
  return "GSTR1_SECTIONS";
}

/**
 * Sale, return or something that never became a supply.
 *
 * Cancellations are dropped: an order cancelled before dispatch was never
 * supplied, so reporting it would overstate both the turnover and the tax.
 */
function readEventType(row: Record<string, string>): TransactionType | "SKIP" {
  const raw = pick(row, "Event Type", "Event Sub Type", "Transaction Type").toUpperCase();
  if (!raw) return "Sales";
  if (raw.includes("CANCEL")) return "SKIP";
  if (raw.includes("RETURN") || raw.includes("REFUND") || raw.includes("RTO")) return "Return";
  return "Sales";
}

export class FlipkartAdapter {
  static adapt(rows: Record<string, string>[], context: SourceContext): AdapterResult {
    const transactions: NormalizedInvoiceRow[] = [];
    const unmappedColumns = new Set<string>();
    let validRows = 0;
    let errorRows = 0;

    const sheetNameLower = (context.sheetName || "").toLowerCase();

    // Instruction and summary tabs carry no transactions. Table 12 and 13 are
    // roll-ups the engine derives from the sales rows, so importing them would
    // double-count every rupee already counted.
    if (
      sheetNameLower.includes("help") ||
      sheetNameLower.includes("section 12") ||
      sheetNameLower.includes("section 13") ||
      sheetNameLower.includes("gstr-8")
    ) {
      return {
        sourceContext: context,
        transactions: [],
        unmappedColumns: [],
        totalRows: rows.length,
        validRows: 0,
        errorRows: 0,
      };
    }

    const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
    const layout = detectLayout(context.sheetName || "", columns);

    const isSection7B2 = sheetNameLower.includes("7(b)(2)") || sheetNameLower.includes("7b2");
    const isSection7A2 = sheetNameLower.includes("7(a)(2)") || sheetNameLower.includes("7a2");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];
      const reviews: string[] = [];

      const hasAnyValue = Object.values(row).some((v) => String(v || "").trim() !== "");
      if (!hasAnyValue) continue;

      const txType = layout === "SELLER_HUB_CREDIT" ? "Return" : readEventType(row);
      if (txType === "SKIP") continue;

      // ── Place of supply ────────────────────────────────────────────────
      // The delivery address decides the place of supply for goods, so it is
      // preferred over the billing address wherever Flipkart gives both.
      const rawPos = pick(
        row,
        "Customer's Delivery State",
        "Delivered State (PoS)",
        "Delivered State Code",
        "Customer's Billing State",
        "Customer State",
        "Delivery State",
        "State"
      );
      const pos = transformStateCode(rawPos) || rawPos;

      // ── Values ─────────────────────────────────────────────────────────
      const taxableValue = round2(
        num(
          pick(
            row,
            "Taxable Value (Final Invoice Amount -Taxes)",
            "Taxable Value",
            "Aggregate Taxable Value Rs.",
            "Gross Taxable Value Rs.",
            "Total Taxable Value Rs.",
            "Taxable Value Rs.",
            "Taxable Amount"
          )
        )
      );

      // A rate-wise section row with no value is a placeholder for a rate that
      // saw no business, not a supply of zero.
      if (taxableValue === 0 && (isSection7B2 || isSection7A2)) continue;

      const igstRate = num(pick(row, "IGST Rate", "IGST %"));
      const cgstRate = num(pick(row, "CGST Rate", "CGST %"));
      const sgstRate = num(
        pick(row, "SGST Rate (or UTGST as applicable)", "SGST/UT %", "SGST Rate")
      );

      let igstAmount = round2(num(pick(row, "IGST Amount", "IGST Amount Rs.", "IGST")));
      let cgstAmount = round2(num(pick(row, "CGST Amount", "CGST Amount Rs.", "CGST")));
      let sgstAmount = round2(
        num(
          pick(
            row,
            "SGST Amount (Or UTGST as applicable)",
            "SGST /UT Amount Rs.",
            "SGST Amount",
            "SGST"
          )
        )
      );
      const cessAmount = round2(
        num(pick(row, "Luxury Cess Amount", "CESS Amount Rs.", "Cess Rs.", "CESS"))
      );

      let totalTax = round2(igstAmount + cgstAmount + sgstAmount + cessAmount);

      if (totalTax === 0 && (igstRate > 0 || cgstRate > 0 || sgstRate > 0)) {
        if (igstRate > 0) igstAmount = round2(taxableValue * (igstRate / 100));
        if (cgstRate > 0) cgstAmount = round2(taxableValue * (cgstRate / 100));
        if (sgstRate > 0) sgstAmount = round2(taxableValue * (sgstRate / 100));
        totalTax = round2(igstAmount + cgstAmount + sgstAmount + cessAmount);
      }

      const totalValue =
        round2(
          num(
            pick(
              row,
              "Buyer Invoice Amount",
              "Final Invoice Amount (Price after discount+Shipping Charges)",
              "Invoice Amount",
              "Total Value Rs.",
              "Invoice Amount Rs."
            )
          )
        ) || round2(taxableValue + totalTax);

      // ── Identities ─────────────────────────────────────────────────────
      // A credit note is identified by its own number, not the order's.
      const rawInvoiceNumber = pick(
        row,
        "Credit Note ID/ Debit Note ID",
        "Buyer Invoice ID",
        "Invoice Number",
        "Order ID",
        "sub_order_num"
      );
      const invoiceNumber =
        rawInvoiceNumber.length > 16 ? rawInvoiceNumber.slice(-16) : rawInvoiceNumber;

      const rawInvoiceDate = pick(
        row,
        "Buyer Invoice Date",
        "Invoice Date",
        "Order Approval Date",
        "Order Date"
      );
      const invoiceDate = transformDate(rawInvoiceDate) || rawInvoiceDate;

      // Flipkart records a business buyer in its own pair of columns; without
      // them every B2B supply on the platform is filed as B2C.
      const buyerGstin = pick(
        row,
        "Business GST Number",
        "Buyer Gstin",
        "Customer GSTIN"
      ).toUpperCase();
      const isB2B = buyerGstin.length === 15;
      const buyerName =
        pick(row, "Business Name", "Beneficiary Name") ||
        (isB2B ? "Flipkart Registered Customer" : "Flipkart B2C Customer");

      let invoiceType: InvoiceCategory = isB2B ? "B2B" : "B2CS";
      if (txType === "Return") invoiceType = isB2B ? "CDNR" : "CDNCS";

      // ── Goods ──────────────────────────────────────────────────────────
      // The section roll-ups carry no HSN at all. Inventing one would put real
      // turnover under a commodity the seller never sold, so the row goes
      // through without it and says so.
      // No fallback code: the shared default is a services HSN, and stamping it
      // on a goods seller's turnover declares a commodity they never sold.
      const hsnCode = transformHsn(pick(row, "HSN Code", "HSN", "HSN/SAC"), "");
      if (!hsnCode) {
        reviews.push(
          layout === "GSTR1_SECTIONS"
            ? "This Flipkart section report has no HSN column — add HSN before filing Table 12."
            : "No HSN code in this row."
        );
      }

      const itemDescription = pick(row, "Product Title/Description", "Product Description");
      const quantity =
        parseInt(pick(row, "Item Quantity", "Total Quantity in Nos.", "Quantity") || "1", 10) || 1;

      if (!pos) errors.push("Missing Place of Supply");

      if (errors.length > 0) {
        errorRows++;
        continue;
      }

      const eco = resolveEcoGstin({
        platformId: "flipkart",
        supplierGstin: context.supplierGstin,
        userFallbackGstin: context.fallbackEcoGstin,
        rowGstin: pick(row, "TCS GSTIN", "GSTIN of Flipkart.Com", "ECO GSTIN"),
      });
      validRows++;

      // Returns are carried as negatives so that netting a period is a sum.
      const sign = txType === "Return" ? -1 : 1;
      const signed = (value: number) => round2(sign * Math.abs(value));

      transactions.push({
        id: crypto.randomUUID(),
        rowIndex: i + 1,
        sourcePlatformId: "flipkart",
        sourcePlatformName: "Flipkart",
        sourceFileName: context.fileName,
        sourceFileType: context.reportType,
        transactionType: txType,

        invoiceNumber,
        invoiceDate,
        invoiceType,

        buyerName,
        buyerGstin: isB2B ? buyerGstin : "",
        placeOfSupply: pos,

        itemDescription: itemDescription || undefined,
        hsnCode,
        uqc: transformUqc(pick(row, "UQC", "Unit")) || "PCS",
        quantity,

        totalValue: signed(totalValue),
        taxableValue: signed(taxableValue),

        igstRate,
        cgstRate,
        sgstRate,
        cessRate: 0,

        igstAmount: signed(igstAmount),
        cgstAmount: signed(cgstAmount),
        sgstAmount: signed(sgstAmount),
        cessAmount: signed(cessAmount),

        ecoGstin: eco.ecoGstin,
        ecoName: eco.ecoName,

        errors,
        reviews,
      });
    }

    return {
      sourceContext: context,
      transactions,
      unmappedColumns: Array.from(unmappedColumns),
      totalRows: rows.length,
      validRows,
      errorRows,
    };
  }
}
