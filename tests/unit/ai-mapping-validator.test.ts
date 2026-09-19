import { describe, it, expect } from "vitest";
import {
  validateAiMapping,
  findDisagreements,
} from "@/features/convert/engine/ai/mapping-validator";
import type { ColumnProfile } from "@/features/convert/engine/universal/types";

function profile(
  header: string,
  hypotheses: { field: string; confidence: number }[] = []
): ColumnProfile {
  return {
    header,
    index: 0,
    samples: [],
    fillRate: 1,
    uniqueness: 1,
    numericRate: 0,
    hypotheses: hypotheses.map((h) => ({ ...h, evidence: [] })),
  };
}

describe("a model's proposal is corroborated, not trusted", () => {
  it("accepts a claim the values agree with", () => {
    const profiles = [profile("Taxable Amount", [{ field: "taxableValue", confidence: 80 }])];

    const { accepted, rejected } = validateAiMapping(
      { "Taxable Amount": "taxableValue" },
      profiles
    );

    expect(accepted).toEqual({ taxableValue: "Taxable Amount" });
    expect(rejected).toHaveLength(0);
  });

  it("drops a column that is not in the file", () => {
    // Models invent plausible column names. Binding one reads undefined into
    // every row of the return.
    const { accepted, rejected } = validateAiMapping({ "Invoice Total": "totalValue" }, [
      profile("Taxable Amount"),
    ]);

    expect(accepted).toEqual({});
    expect(rejected[0]!.reason).toMatch(/no column with this name/i);
  });

  it("drops a field this engine does not fill", () => {
    const { accepted, rejected } = validateAiMapping({ "Shipping Cost": "freightCharges" }, [
      profile("Shipping Cost"),
    ]);

    expect(accepted).toEqual({});
    expect(rejected[0]!.reason).toMatch(/not a GST field/i);
  });

  it("overrules the model when the values say something else entirely", () => {
    // A column of dates proposed as a taxable value is exactly the claim that
    // survives reasoning about the header alone.
    const profiles = [
      profile("Order Ref", [
        { field: "invoiceDate", confidence: 90 },
        { field: "taxableValue", confidence: 10 },
      ]),
    ];

    const { accepted, rejected } = validateAiMapping({ "Order Ref": "taxableValue" }, profiles);

    expect(accepted).toEqual({});
    expect(rejected[0]!.reason).toMatch(/look like invoiceDate/i);
  });

  it("lets the model win where the engine is only narrowly ahead", () => {
    // The engine is a scorer, not an oracle; a narrow lead is noise.
    const profiles = [
      profile("Bill Value", [
        { field: "totalValue", confidence: 60 },
        { field: "taxableValue", confidence: 52 },
      ]),
    ];

    const { accepted } = validateAiMapping({ "Bill Value": "taxableValue" }, profiles);

    expect(accepted).toEqual({ taxableValue: "Bill Value" });
  });

  it("does not let weak engine evidence overrule anything", () => {
    const profiles = [profile("Amount", [{ field: "totalValue", confidence: 20 }])];

    const { accepted } = validateAiMapping({ Amount: "taxableValue" }, profiles);

    expect(accepted).toEqual({ taxableValue: "Amount" });
  });
});

describe("two columns claiming the same field", () => {
  it("keeps the one the values back", () => {
    // Previously the last entry silently won, whichever it happened to be.
    const profiles = [
      profile("Order No", [{ field: "invoiceNumber", confidence: 30 }]),
      profile("Invoice No", [{ field: "invoiceNumber", confidence: 85 }]),
    ];

    const { accepted, rejected } = validateAiMapping(
      { "Order No": "invoiceNumber", "Invoice No": "invoiceNumber" },
      profiles
    );

    expect(accepted).toEqual({ invoiceNumber: "Invoice No" });
    expect(rejected[0]!.header).toBe("Order No");
  });

  it("asks when nothing distinguishes them", () => {
    // Choosing at random here is the difference between a question and a
    // wrong invoice number on every row.
    const profiles = [
      profile("Ref A", [{ field: "invoiceNumber", confidence: 50 }]),
      profile("Ref B", [{ field: "invoiceNumber", confidence: 50 }]),
    ];

    const { accepted, rejected } = validateAiMapping(
      { "Ref A": "invoiceNumber", "Ref B": "invoiceNumber" },
      profiles
    );

    expect(accepted).toEqual({});
    expect(rejected).toHaveLength(2);
    expect(rejected[0]!.reason).toMatch(/nothing distinguishes/i);
  });
});

describe("disagreement between the two models", () => {
  it("is reported per header", () => {
    const a = [
      { excelHeader: "Amount", canonicalKey: "taxableValue" },
      { excelHeader: "Date", canonicalKey: "invoiceDate" },
    ];
    const b = [
      { excelHeader: "Amount", canonicalKey: "totalValue" },
      { excelHeader: "Date", canonicalKey: "invoiceDate" },
    ];

    expect(findDisagreements(a, b)).toEqual(["Amount"]);
  });

  it("does not count a header only one model mentioned", () => {
    // Silence is not disagreement.
    const a = [{ excelHeader: "Amount", canonicalKey: "taxableValue" }];
    const b: { excelHeader: string; canonicalKey: string | null }[] = [];

    expect(findDisagreements(a, b)).toEqual([]);
  });

  it("sends a disputed column to the user rather than picking a side", () => {
    const profiles = [profile("Amount", [{ field: "taxableValue", confidence: 70 }])];

    const { accepted, rejected } = validateAiMapping({ Amount: "taxableValue" }, profiles, {
      disagreedHeaders: ["Amount"],
    });

    expect(accepted).toEqual({});
    expect(rejected[0]!.reason).toMatch(/models read this column differently/i);
  });
});
