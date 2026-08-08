import { describe, expect, it } from "vitest";

import { validateInvoices } from "@/features/convert/domain/validator";
import {
  solveTable,
  toCanonicalRows,
} from "@/features/convert/engine/universal/universal-import.engine";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";
import { RuleEngine } from "@/features/convert/engine/rules/rule.engine";
import { transformMappedRows } from "@/features/convert/engine/transformation/transformation.engine";
import {
  transformDate,
  transformTaxRate,
} from "@/features/convert/engine/transformation/transformers";
import { mergeTransactions } from "@/features/convert/engine/merge.engine";

const SUPPLIER_GSTIN = "09AMLPU1171B1Z1";

const MEESHO_HEADERS = [
  "identifier",
  "sup_name",
  "gstin",
  "sub_order_num",
  "order_date",
  "hsn_code",
  "quantity",
  "gst_rate",
  "total_taxable_sale_value",
  "tax_amount",
  "total_invoice_value",
  "end_customer_state_new",
  "eco_tcs_gstin",
];

const MEESHO_ROW: Record<string, unknown> = {
  identifier: "93dqm",
  sup_name: "DECORATIVE METAL",
  gstin: SUPPLIER_GSTIN,
  sub_order_num: "284155610382653312_1",
  order_date: "2026-05-08",
  hsn_code: "732399",
  quantity: "1",
  gst_rate: "18.00",
  total_taxable_sale_value: "304.3050847457627",
  tax_amount: "54.774915254237285",
  total_invoice_value: "359.08",
  end_customer_state_new: "MAHARASHTRA",
  eco_tcs_gstin: "09AARCM9332R1CM",
};

function runPipeline(
  headers: string[],
  rawRows: Record<string, unknown>[],
  platformId: string,
  fileTypeId: string
) {
  const table: ReconstructedTable = {
    sheetName: "Sheet1",
    headers,
    rows: rawRows as Record<string, string>[],
    headerRowIndex: 0,
    headerRowSpan: 1,
    discarded: [],
    score: 100,
  };
  const solved = solveTable(table, { fileName: `${fileTypeId}.xlsx` });
  const mapped = toCanonicalRows(table, solved.mapping);
  const transformed = transformMappedRows(mapped, {
    platformId,
    platformName: platformId,
    fileName: `${fileTypeId}.xlsx`,
    fileTypeId,
    supplierGstin: SUPPLIER_GSTIN,
  });
  const ruled = RuleEngine.applyRowRules(transformed, platformId);
  return {
    mapping: solved.mapping,
    rows: ruled,
    validation: validateInvoices(ruled, SUPPLIER_GSTIN),
  };
}

describe("Meesho TCS mapping", () => {
  it("maps sub_order_num and end_customer_state_new rather than generic columns", () => {
    const { mapping } = runPipeline(MEESHO_HEADERS, [MEESHO_ROW], "meesho", "tcs_sales");

    expect(mapping.invoiceNumber).toBe("sub_order_num");
    expect(mapping.placeOfSupply).toBe("end_customer_state_new");
    expect(mapping.taxableValue).toBe("total_taxable_sale_value");
  });

  it("never maps a tax amount onto the eco_tcs_gstin column", () => {
    const { mapping } = runPipeline(MEESHO_HEADERS, [MEESHO_ROW], "meesho", "tcs_sales");

    expect(mapping.sgstAmount).not.toBe("eco_tcs_gstin");
    expect(mapping.cgstAmount).not.toBe("eco_tcs_gstin");
  });

  it("does not treat the supplier's own GSTIN as a buyer GSTIN", () => {
    const { rows } = runPipeline(MEESHO_HEADERS, [MEESHO_ROW], "meesho", "tcs_sales");

    expect(rows[0]?.buyerGstin).toBe("");
    expect(rows[0]?.invoiceType).toBe("B2CS");
  });

  it("truncates marketplace order ids to the GSTR-1 16 character limit", () => {
    const { rows } = runPipeline(MEESHO_HEADERS, [MEESHO_ROW], "meesho", "tcs_sales");

    expect(rows[0]?.invoiceNumber).toBe("55610382653312_1");
    expect(rows[0]?.invoiceNumber.length).toBeLessThanOrEqual(16);
  });

  it("produces no validation errors for a clean TCS row", () => {
    const { validation } = runPipeline(MEESHO_HEADERS, [MEESHO_ROW], "meesho", "tcs_sales");

    expect(validation.rows[0]?.errors).toEqual([]);
  });

  it("allows a sales return to reuse the original order number", () => {
    const sale = runPipeline(MEESHO_HEADERS, [MEESHO_ROW], "meesho", "tcs_sales").rows;
    const ret = runPipeline(MEESHO_HEADERS, [MEESHO_ROW], "meesho", "tcs_sales_return").rows;

    const validation = validateInvoices([...sale, ...ret], SUPPLIER_GSTIN);

    expect(validation.errorCount).toBe(0);
  });
});

describe("Amazon MTR mapping", () => {
  const AMAZON_HEADERS = [
    "Seller Gstin",
    "Invoice Number",
    "Invoice Date",
    "Transaction Type",
    "Quantity",
    "Hsn/sac",
    "Ship To State",
    "Invoice Amount",
    "Tax Exclusive Gross",
    "Total Tax Amount",
    "Igst Rate",
    "Cgst Rate",
    "Sgst Rate",
    "Cgst Tax",
    "Sgst Tax",
    "Igst Tax",
    "Customer Bill To Gstid",
  ];

  const interStateRow: Record<string, unknown> = {
    "Seller Gstin": SUPPLIER_GSTIN,
    "Invoice Number": "IN-194",
    "Invoice Date": "2026-05-03",
    "Transaction Type": "Shipment",
    Quantity: "2",
    "Hsn/sac": "9403",
    "Ship To State": "RAJASTHAN",
    "Invoice Amount": "2908.06",
    "Tax Exclusive Gross": "2769.58",
    "Total Tax Amount": "138.48",
    "Igst Rate": "0.05",
    "Cgst Rate": "0",
    "Sgst Rate": "0",
    // Pre-promo-discount component columns that disagree with the taxable value.
    "Cgst Tax": "0",
    "Sgst Tax": "0",
    "Igst Tax": "142.76",
    "Customer Bill To Gstid": "",
  };

  const cancelRow: Record<string, unknown> = {
    ...interStateRow,
    "Invoice Number": "",
    "Transaction Type": "Cancel",
    "Hsn/sac": "",
    "Invoice Amount": "0",
    "Tax Exclusive Gross": "0",
    "Total Tax Amount": "0",
    "Igst Tax": "0",
  };

  it("prefers Total Tax Amount over the pre-discount component tax columns", () => {
    const { mapping, validation } = runPipeline(
      AMAZON_HEADERS,
      [interStateRow],
      "amazon",
      "mtr_b2c"
    );

    expect(mapping.igstAmount).toBe("Total Tax Amount");
    expect(validation.rows[0]?.igstAmount).toBe(138.48);
    expect(validation.rows[0]?.errors).toEqual([]);
  });

  it("never binds the buyer name to a GSTIN column", () => {
    // Amazon MTR has no buyer-name column, and the alias "customer" is a whole token of
    // "Customer Bill To Gstid" — so the name field used to fuzzy-match onto the GSTIN, and the
    // buyer's name rendered as a GSTIN throughout the workbench.
    const gstinRow = { ...interStateRow, "Customer Bill To Gstid": "27AABCU9603R1ZM" };
    const { mapping, rows } = runPipeline(AMAZON_HEADERS, [gstinRow], "amazon", "mtr_b2c");

    expect(mapping.buyerName).not.toBe("Customer Bill To Gstid");
    expect(rows[0]?.buyerName).not.toBe("27AABCU9603R1ZM");
    expect(rows[0]?.buyerGstin).toBe("27AABCU9603R1ZM");
  });

  it("drops cancelled rows that carry no value", () => {
    const { rows } = runPipeline(AMAZON_HEADERS, [interStateRow, cancelRow], "amazon", "mtr_b2c");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.invoiceNumber).toBe("IN-194");
  });

  it("splits a single total-tax column into CGST and SGST for intra-state supplies", () => {
    const intraStateRow = { ...interStateRow, "Ship To State": "UTTAR PRADESH" };

    const { validation } = runPipeline(AMAZON_HEADERS, [intraStateRow], "amazon", "mtr_b2c");
    const row = validation.rows[0];

    expect(row?.igstAmount).toBe(0);
    expect(row?.cgstAmount).toBe(69.24);
    expect(row?.sgstAmount).toBe(69.24);
    expect(row?.errors).toEqual([]);
  });
});

describe("fallback ECO GSTIN", () => {
  const MAPPING = {
    invoiceNumber: "Inv",
    invoiceDate: "Date",
    placeOfSupply: "POS",
    hsnCode: "HSN",
    taxableValue: "Taxable",
    igstRate: "GST %",
    ecoGstin: "ECO",
  };
  const run = (eco: string, fallbackEcoGstin?: string) =>
    transformMappedRows(
      toCanonicalRows(
        {
          sheetName: "Sheet1",
          headers: ["Inv", "Date", "POS", "HSN", "Taxable", "GST %", "ECO"],
          rows: [
            {
              Inv: "INV1",
              Date: "2026-05-01",
              POS: "27",
              HSN: "610910",
              Taxable: "1000",
              "GST %": "18",
              ECO: eco,
            },
          ] as never,
          headerRowIndex: 0,
          headerRowSpan: 1,
          discarded: [],
          score: 100,
        },
        MAPPING
      ),
      {
        platformId: "amazon",
        platformName: "Amazon",
        fileName: "mtr.xlsx",
        fileTypeId: "b2c",
        supplierGstin: SUPPLIER_GSTIN,
        fallbackEcoGstin,
      }
    )[0]!;

  it("fills the operator GSTIN from configuration when the export has no column value", () => {
    // Amazon's MTR carries no operator GSTIN, so without this Table 14 is unfillable for it.
    expect(run("", "27AAICA3918J1CX").ecoGstin).toBe("27AAICA3918J1CX");
  });

  it("lets the file's own value win over the configured fallback", () => {
    expect(run("09AARCM9332R1CM", "27AAICA3918J1CX").ecoGstin).toBe("09AARCM9332R1CM");
  });

  it("never accepts the seller's own GSTIN as their operator", () => {
    expect(run("", SUPPLIER_GSTIN).ecoGstin).toBeUndefined();
  });
});

describe("transformTaxRate", () => {
  it("preserves fractional GST slabs instead of rounding to whole percents", () => {
    expect(transformTaxRate("0.025")).toBe(2.5);
    expect(transformTaxRate("0.05")).toBe(5);
    expect(transformTaxRate("0.18")).toBe(18);
    expect(transformTaxRate("18.00")).toBe(18);
  });
});

describe("transformDate", () => {
  it("keeps the calendar day intact for timezones ahead of UTC", () => {
    // toISOString() would report 2026-04-30 for an IST-midnight date.
    expect(transformDate("5/1/26")).toBe("2026-05-01");
    expect(transformDate(new Date(2026, 4, 1))).toBe("2026-05-01");
    expect(transformDate("46143")).toBe("2026-05-01");
  });

  it("reads unambiguous explicit formats as written", () => {
    expect(transformDate("01/05/2026")).toBe("2026-05-01");
    expect(transformDate("2026-05-01")).toBe("2026-05-01");
  });
});

describe("generic custom spreadsheets", () => {
  const CUSTOM_HEADERS = [
    "Invoice No",
    "Date",
    "Buyer",
    "GSTIN",
    "POS",
    "HSN",
    "Qty",
    "GST %",
    "Taxable",
    "IGST",
    "CGST",
    "SGST",
    "Total",
  ];

  const customRow = (over: Record<string, unknown>) => ({
    "Invoice No": "INV001",
    Date: "5/1/26",
    Buyer: "Rahul Traders",
    GSTIN: "07AAACR5055K1Z5",
    POS: "7",
    HSN: "610910",
    Qty: "2",
    "GST %": "5",
    Taxable: "1000",
    IGST: "50",
    CGST: "0",
    SGST: "0",
    Total: "1050",
    ...over,
  });

  it("maps a plain 'GST %' column onto the rate rather than leaving it unmapped", () => {
    const { mapping } = runPipeline(CUSTOM_HEADERS, [customRow({})], "custom", "sales");

    expect(mapping.igstRate).toBe("GST %");
    expect(mapping.buyerName).toBe("Buyer");
  });

  it("accepts supplied tax amounts instead of assuming a default slab", () => {
    const rows = [
      customRow({}),
      customRow({
        "Invoice No": "INV004",
        GSTIN: "",
        POS: "9",
        "GST %": "28",
        Taxable: "3000",
        IGST: "0",
        CGST: "420",
        SGST: "420",
        Total: "3840",
      }),
    ];

    const { validation } = runPipeline(CUSTOM_HEADERS, rows, "custom", "sales");

    expect(validation.rows[0]?.invoiceType).toBe("B2B");
    expect(validation.rows[0]?.igstAmount).toBe(50);
    expect(validation.rows[1]?.invoiceType).toBe("B2CS");
    expect(validation.rows[1]?.cgstRate).toBe(14);
    expect(validation.errorCount).toBe(0);
  });
});

describe("return rows inherit their original sale", () => {
  const MAPPING = {
    invoiceNumber: "Invoice No",
    invoiceDate: "Date",
    buyerName: "Buyer",
    buyerGstin: "GSTIN",
    placeOfSupply: "POS",
    hsnCode: "HSN",
    quantity: "Qty",
    igstRate: "GST %",
    taxableValue: "Taxable",
    igstAmount: "IGST",
    cgstAmount: "CGST",
    sgstAmount: "SGST",
    totalValue: "Total",
  };

  it("fills place of supply and rate from the matching sale instead of erroring", () => {
    const saleRows = toCanonicalRows(
      {
        sheetName: "Sheet1",
        headers: Object.values(MAPPING),
        rows: [
          {
            "Invoice No": "AMZ002",
            Date: "2026-05-01",
            Buyer: "Priya Enterprises",
            GSTIN: "27AABCU9603R1ZM",
            POS: "27",
            HSN: "950300",
            Qty: "1",
            "GST %": "18",
            Taxable: "25000",
            IGST: "4500",
            CGST: "0",
            SGST: "0",
            Total: "29500",
          },
        ] as never,
        headerRowIndex: 0,
        headerRowSpan: 1,
        discarded: [],
        score: 100,
      },
      MAPPING
    );
    const returnRows = toCanonicalRows(
      {
        sheetName: "Sheet1",
        headers: Object.values(MAPPING),
        rows: [
          {
            "Invoice No": "AMZ002",
            Date: "2026-05-10",
            Buyer: "",
            GSTIN: "",
            POS: "",
            HSN: "",
            Qty: "1",
            "GST %": "",
            Taxable: "-5000",
            IGST: "0",
            CGST: "-450",
            SGST: "-450",
            Total: "-5900",
          },
        ] as never,
        headerRowIndex: 0,
        headerRowSpan: 1,
        discarded: [],
        score: 100,
      },
      MAPPING
    );

    const ctx = (fileTypeId: string) => ({
      platformId: "amazon",
      platformName: "amazon",
      fileName: `${fileTypeId}.xlsx`,
      fileTypeId,
      supplierGstin: SUPPLIER_GSTIN,
    });

    const merged = mergeTransactions([
      {
        platformId: "amazon",
        platformName: "Amazon",
        fileName: "sales.xlsx",
        fileTypeId: "sales",
        rows: RuleEngine.applyRowRules(transformMappedRows(saleRows, ctx("sales")), "amazon"),
      },
      {
        platformId: "amazon",
        platformName: "Amazon",
        fileName: "returns.xlsx",
        fileTypeId: "returns",
        rows: RuleEngine.applyRowRules(transformMappedRows(returnRows, ctx("returns")), "amazon"),
      },
    ]);

    const ret = merged.mergedRows.find((r) => r.transactionType === "Return");
    expect(ret?.placeOfSupply).toBe("27");
    expect(ret?.buyerGstin).toBe("27AABCU9603R1ZM");
    expect(ret?.buyerName).toBe("Priya Enterprises");
    expect(ret?.hsnCode).toBe("950300");
    expect(ret?.originalInvoiceNumber).toBe("AMZ002");
    expect(ret?.igstRate).toBe(18);
    // Sale was inter-state, so the return's CGST/SGST must collapse back into IGST.
    expect(ret?.igstAmount).toBe(-900);
    expect(ret?.cgstAmount).toBe(0);

    const validation = validateInvoices(merged.mergedRows, SUPPLIER_GSTIN);
    expect(validation.errorCount).toBe(0);
  });
});

describe("GST rate resolution priority", () => {
  const MAPPING = {
    invoiceNumber: "Inv",
    invoiceDate: "Date",
    placeOfSupply: "POS",
    hsnCode: "HSN",
    taxableValue: "Taxable",
    igstAmount: "Tax",
  };
  const ctx = {
    platformId: "custom",
    platformName: "custom",
    fileName: "sales.xlsx",
    fileTypeId: "sales",
    supplierGstin: SUPPLIER_GSTIN,
  };
  const run = (taxable: string, tax: string) =>
    transformMappedRows(
      toCanonicalRows(
        {
          sheetName: "Sheet1",
          headers: ["Inv", "Date", "POS", "HSN", "Taxable", "Tax"],
          rows: [
            {
              Inv: "INV1",
              Date: "2026-05-01",
              POS: "27",
              HSN: "610910",
              Taxable: taxable,
              Tax: tax,
            },
          ] as never,
          headerRowIndex: 0,
          headerRowSpan: 1,
          discarded: [],
          score: 100,
        },
        MAPPING
      ),
      ctx
    )[0]!;

  it("derives the rate from taxable and tax when the file has no rate column", () => {
    const row = run("1000", "180");
    expect(row.igstRate).toBe(18);
    expect(row.igstAmount).toBe(180);
    expect(validateInvoices([row], SUPPLIER_GSTIN).errorCount).toBe(0);
  });

  it("flags the row instead of assuming a slab when the ratio is not a real GST rate", () => {
    const row = run("1000", "70");
    expect(row.igstRate).toBe(0);
    expect(validateInvoices([row], SUPPLIER_GSTIN).rows[0]?.errors).toContain(
      "GST rate could not be determined — enter the rate for this row"
    );
  });

  it("flags the row when neither a rate nor a tax amount is present", () => {
    const row = run("1000", "0");
    expect(row.igstRate).toBe(0);
    expect(validateInvoices([row], SUPPLIER_GSTIN).errorCount).toBe(1);
  });
});
