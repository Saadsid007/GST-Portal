import { describe, it, expect } from "vitest";
import { runConversionPipeline } from "@/features/convert/engine/pipeline/conversion.pipeline";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";

const GSTIN = "09BUXPG2404E1ZM";

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
  "taxable_shipping",
  "end_customer_state_new",
  "enrollment_no",
  "manifest_date",
  "transaction_type",
  "eco_tcs_gstin",
  "financial_year",
  "month_number",
  "supplier_id",
];

function meeshoRow(over: Record<string, string>): Record<string, string> {
  return {
    identifier: "zk53g",
    sup_name: "INNOVATIVE EXPORTS",
    gstin: GSTIN,
    sub_order_num: "314816656299721409_1",
    order_date: "2026-08-02",
    hsn_code: "950300",
    quantity: "1",
    gst_rate: "5.00",
    total_taxable_sale_value: "500.00",
    tax_amount: "25.00",
    total_invoice_value: "525.00",
    taxable_shipping: "0",
    end_customer_state_new: "KARNATAKA",
    enrollment_no: "",
    manifest_date: "2026-08-02",
    transaction_type: "",
    eco_tcs_gstin: "09AARCM9332R1CM",
    financial_year: "2026",
    month_number: "8",
    supplier_id: "70379",
    ...over,
  };
}

function table(
  sheetName: string,
  rows: Record<string, string>[],
  extra: string[] = []
): ReconstructedTable {
  return {
    sheetName,
    headers: [...MEESHO_HEADERS, ...extra],
    rows,
    headerRowIndex: 0,
    headerRowSpan: 1,
    discarded: [],
    score: 100,
  };
}

describe("the conversion the product runs", () => {
  it("counts a return typed under the sales export once, not twice", async () => {
    // The accountant's copy of a return, typed below the sales rows with no
    // order reference, and the same return in Meesho's own returns export.
    // The one-copy rule was applied to a list the product never read, and in
    // the product every such return was counted twice — a state that should
    // have netted to -260 filed at -520.
    const credit = {
      total_taxable_sale_value: "143.81",
      tax_amount: "7.19",
      total_invoice_value: "151.00",
    };

    const result = await runConversionPipeline({
      rawTables: [
        {
          fileId: "tcs_sales.xlsx",
          fileName: "tcs_sales.xlsx",
          table: table("Sheet1", [
            meeshoRow({}),
            meeshoRow({
              sub_order_num: "",
              total_taxable_sale_value: "-143.81",
              tax_amount: "-7.19",
              total_invoice_value: "-151.00",
            }),
          ]),
        },
        {
          fileId: "tcs_sales_return.xlsx",
          fileName: "tcs_sales_return.xlsx",
          table: table(
            "Sheet1",
            [
              meeshoRow({
                sub_order_num: "315313078833763840_1",
                ...credit,
                cancel_return_date: "2026-08-10",
              }),
            ],
            ["cancel_return_date"]
          ),
        },
      ],
      files: [
        { fileName: "tcs_sales.xlsx", platformId: "meesho", fileTypeId: "sales" },
        { fileName: "tcs_sales_return.xlsx", platformId: "meesho", fileTypeId: "returns" },
      ],
      gstinNumber: GSTIN,
      returnPeriod: "082026",
    });

    const b2cs = JSON.parse(result!.gstr1Json).b2cs as { pos: string; txval: number }[];
    const karnataka = b2cs.filter((b) => b.pos === "29").reduce((s, b) => s + b.txval, 0);

    expect(karnataka).toBeCloseTo(500 - 143.81, 2);
  });
});
