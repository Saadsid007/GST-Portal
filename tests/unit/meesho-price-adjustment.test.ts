import { describe, it, expect } from "vitest";
import { MeeshoAdapter } from "@/features/convert/engine/adapters/meesho.adapter";

const GSTIN = "09BCCPS2577M1ZX";
const context = {
  marketplace: "MEESHO",
  sourceId: "m",
  fileId: "tcs_sales.xlsx",
  fileName: "tcs_sales.xlsx",
  sourceRow: 0,
  sheetName: "Sheet1",
  reportType: "tcs_sales",
  supplierGstin: GSTIN,
};

function sale(over: Record<string, string>): Record<string, string> {
  return {
    sub_order_num: "1234567890123_1",
    order_date: "2026-08-03",
    hsn_code: "6204",
    quantity: "1",
    gst_rate: "5",
    total_taxable_sale_value: "380.95",
    tax_amount: "19.05",
    total_invoice_value: "400",
    end_customer_state_new: "TAMIL NADU",
    transaction_type: "",
    ...over,
  };
}

describe("a Meesho price reduction in the sales report", () => {
  const { transactions } = MeeshoAdapter.adapt(
    [
      sale({}),
      // Value goes back, no goods do: Meesho writes quantity 0.
      sale({
        quantity: "0",
        total_taxable_sale_value: "-47.62",
        tax_amount: "-2.38",
        total_invoice_value: "-50",
      }),
      sale({
        sub_order_num: "",
        quantity: "",
        total_taxable_sale_value: "95.24",
        tax_amount: "4.76",
      }),
    ],
    context
  );

  it("reduces the value but takes no unit off Table 12", () => {
    const reduction = transactions.find((t) => t.transactionType === "Return")!;
    expect(reduction.taxableValue).toBeCloseTo(47.62, 2);
    expect(reduction.quantity).toBe(0);
  });

  it("still counts one unit when the quantity cell is blank", () => {
    expect(transactions.find((t) => t.taxableValue === 95.24)!.quantity).toBe(1);
  });
});
