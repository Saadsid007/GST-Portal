/**
 * Self-contained dataset for the public homepage demo.
 *
 * Every figure below reconciles: the gross of the raw rows (₹6,165.00) equals
 * the net taxable value plus tax of the generated output (₹5,500.00 + ₹665.00).
 * A CA will check that, so it has to hold.
 *
 * The seller is registered in Karnataka (29), which is what makes the
 * intra-state rows split into CGST + SGST and the rest fall to IGST.
 */

export const DEMO_SELLER = {
  gstin: "29AABCU9603R1ZX",
  legalName: "Nova Retail Ventures Pvt Ltd",
  stateCode: "29",
  stateName: "Karnataka",
  returnPeriod: "082026",
  returnPeriodLabel: "August 2026",
  sourceFile: "Amazon_MTR_B2C_Aug2026.xlsx",
} as const;

export interface RawRow {
  orderId: string;
  invoiceDate: string;
  /** Free-text state exactly as marketplaces export it — no code, mixed case. */
  shipToState: string;
  transactionType: "Shipment" | "Refund";
  /** Gross, tax-inclusive, formatted as a string with a currency symbol. */
  invoiceAmount: string;
  /** Rate as an exported string, not a number. */
  taxRate: string;
  hsn: string;
}

/** Raw marketplace export — deliberately messy, the way the real file arrives. */
export const RAW_ROWS: RawRow[] = [
  {
    orderId: "408-3719411-communal",
    invoiceDate: "03-08-2026",
    shipToState: "KARNATAKA",
    transactionType: "Shipment",
    invoiceAmount: "₹1,180.00",
    taxRate: "18%",
    hsn: "610910",
  },
  {
    orderId: "171-9930244-lateral",
    invoiceDate: "07-08-2026",
    shipToState: "Maharashtra",
    transactionType: "Shipment",
    invoiceAmount: "₹1,180.00",
    taxRate: "18%",
    hsn: "610910",
  },
  {
    orderId: "402-6621807-tandem",
    invoiceDate: "12-08-2026",
    shipToState: "maharashtra ",
    transactionType: "Shipment",
    invoiceAmount: "₹2,360.00",
    taxRate: "18%",
    hsn: "610910",
  },
  {
    orderId: "171-9930244-lateral",
    invoiceDate: "19-08-2026",
    shipToState: "Maharashtra",
    transactionType: "Refund",
    invoiceAmount: "-₹1,180.00",
    taxRate: "18%",
    hsn: "610910",
  },
  {
    orderId: "404-1180255-vertex",
    invoiceDate: "22-08-2026",
    shipToState: "Delhi",
    transactionType: "Shipment",
    invoiceAmount: "₹525.00",
    taxRate: "5%",
    hsn: "640399",
  },
  {
    orderId: "408-7724190-quartz",
    invoiceDate: "28-08-2026",
    shipToState: "Karnataka",
    transactionType: "Shipment",
    invoiceAmount: "₹2,100.00",
    taxRate: "5%",
    hsn: "640399",
  },
];

export interface Gstr1Row {
  /** GSTR-1 table this row belongs to. */
  table: string;
  placeOfSupply: string;
  rate: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  /** Which raw row indices collapsed into this line. */
  sourceRows: number[];
  /** Set when a refund was netted off, so the UI can flag it. */
  netted?: boolean;
}

/**
 * B2CS output, grouped by place of supply and rate — exactly how GSTR-1 table 7
 * expects it, and the reason six raw lines become four.
 */
export const GSTR1_ROWS: Gstr1Row[] = [
  {
    table: "B2CS",
    placeOfSupply: "29-Karnataka",
    rate: 18,
    taxableValue: 1000,
    igst: 0,
    cgst: 90,
    sgst: 90,
    sourceRows: [0],
  },
  {
    table: "B2CS",
    placeOfSupply: "29-Karnataka",
    rate: 5,
    taxableValue: 2000,
    igst: 0,
    cgst: 50,
    sgst: 50,
    sourceRows: [5],
  },
  {
    table: "B2CS",
    placeOfSupply: "27-Maharashtra",
    rate: 18,
    taxableValue: 2000,
    igst: 360,
    cgst: 0,
    sgst: 0,
    sourceRows: [1, 2, 3],
    netted: true,
  },
  {
    table: "B2CS",
    placeOfSupply: "07-Delhi",
    rate: 5,
    taxableValue: 500,
    igst: 25,
    cgst: 0,
    sgst: 0,
    sourceRows: [4],
  },
];

export const DEMO_TOTALS = {
  rawLineCount: RAW_ROWS.length,
  outputLineCount: GSTR1_ROWS.length,
  grossValue: 6165,
  netTaxable: GSTR1_ROWS.reduce((sum, r) => sum + r.taxableValue, 0),
  totalTax: GSTR1_ROWS.reduce((sum, r) => sum + r.igst + r.cgst + r.sgst, 0),
  refundsNetted: 1180,
};

/** The transformations worth calling out beside the diff. */
export const TRANSFORMATIONS = [
  {
    id: "state",
    label: "State names → GSTN state codes",
    detail: '"maharashtra " became "27-Maharashtra" — trimmed, cased and coded.',
  },
  {
    id: "net",
    label: "Sales returns netted off",
    detail: "A ₹1,180 refund was subtracted from its original shipment, not filed separately.",
  },
  {
    id: "tax",
    label: "Tax extracted from gross",
    detail: "Tax-inclusive invoice values were split into taxable value and tax.",
  },
  {
    id: "split",
    label: "IGST vs CGST + SGST resolved",
    detail: "Place of supply compared against the seller's state on every line.",
  },
  {
    id: "group",
    label: "Grouped into GSTR-1 table 7",
    detail: "6 raw lines collapsed into 4 B2CS rows keyed by place of supply and rate.",
  },
];

export const PIPELINE_STAGES = [
  "Reading workbook",
  "Detecting marketplace format",
  "Mapping columns",
  "Normalising states & rates",
  "Netting sales returns",
  "Splitting IGST / CGST / SGST",
  "Validating against GSTN rules",
  "Building GSTR-1 tables",
];

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatInr(value: number): string {
  return INR.format(value);
}

/** Builds the downloadable demo output client-side — no server round-trip. */
export function buildDemoCsv(): string {
  const header = ["Table", "Place Of Supply", "Rate (%)", "Taxable Value", "IGST", "CGST", "SGST"];
  const lines = GSTR1_ROWS.map((r) =>
    [r.table, r.placeOfSupply, r.rate, r.taxableValue, r.igst, r.cgst, r.sgst].join(",")
  );
  const totals = [
    "TOTAL",
    "",
    "",
    DEMO_TOTALS.netTaxable,
    GSTR1_ROWS.reduce((s, r) => s + r.igst, 0),
    GSTR1_ROWS.reduce((s, r) => s + r.cgst, 0),
    GSTR1_ROWS.reduce((s, r) => s + r.sgst, 0),
  ].join(",");

  return [
    `# GSTPilot demo output — ${DEMO_SELLER.legalName}`,
    `# GSTIN ${DEMO_SELLER.gstin} | Period ${DEMO_SELLER.returnPeriodLabel}`,
    "# Sample data for demonstration only. Not for filing.",
    "",
    header.join(","),
    ...lines,
    totals,
  ].join("\n");
}
