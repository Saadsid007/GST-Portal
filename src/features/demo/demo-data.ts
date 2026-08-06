import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Self-contained dataset for the public homepage demo.
 *
 * These rows are shaped as real `NormalizedInvoiceRow`s so the demo downloads
 * can be produced by the *same* generators the product uses — the visitor gets
 * a genuine GSTR-1 JSON, GSTN workbook and CA review report, not a mock-up.
 *
 * Every figure reconciles: gross of the raw lines equals net taxable + tax.
 * A CA will check that, so it has to hold. The arithmetic is asserted by
 * `tests/unit/demo-data.test.ts`.
 *
 * Seller is registered in Karnataka (29), which is what makes intra-state rows
 * split into CGST + SGST while everything else falls to IGST.
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
  platform: string;
}

/** Raw marketplace export — deliberately messy, the way the real file arrives. */
export const RAW_ROWS: RawRow[] = [
  {
    orderId: "408-3719411-8842",
    invoiceDate: "03-08-2026",
    shipToState: "KARNATAKA",
    transactionType: "Shipment",
    invoiceAmount: "₹1,180.00",
    taxRate: "18%",
    hsn: "610910",
    platform: "Amazon",
  },
  {
    orderId: "171-9930244-2201",
    invoiceDate: "05-08-2026",
    shipToState: "Maharashtra",
    transactionType: "Shipment",
    invoiceAmount: "₹1,180.00",
    taxRate: "18%",
    hsn: "610910",
    platform: "Amazon",
  },
  {
    orderId: "402-6621807-7714",
    invoiceDate: "08-08-2026",
    shipToState: "maharashtra ",
    transactionType: "Shipment",
    invoiceAmount: "₹2,360.00",
    taxRate: "18%",
    hsn: "610910",
    platform: "Amazon",
  },
  {
    orderId: "171-9930244-2201",
    invoiceDate: "19-08-2026",
    shipToState: "Maharashtra",
    transactionType: "Refund",
    invoiceAmount: "-₹1,180.00",
    taxRate: "18%",
    hsn: "610910",
    platform: "Amazon",
  },
  {
    orderId: "404-1180255-3390",
    invoiceDate: "11-08-2026",
    shipToState: "Delhi",
    transactionType: "Shipment",
    invoiceAmount: "₹525.00",
    taxRate: "5%",
    hsn: "640399",
    platform: "Amazon",
  },
  {
    orderId: "MEE-5540912",
    invoiceDate: "12-08-2026",
    shipToState: "Tamil Nadu",
    transactionType: "Shipment",
    invoiceAmount: "₹2,100.00",
    taxRate: "5%",
    hsn: "640399",
    platform: "Meesho",
  },
  {
    orderId: "MEE-5540912",
    invoiceDate: "24-08-2026",
    shipToState: "TAMILNADU",
    transactionType: "Refund",
    invoiceAmount: "-₹525.00",
    taxRate: "5%",
    hsn: "640399",
    platform: "Meesho",
  },
  {
    orderId: "FK-77120945",
    invoiceDate: "16-08-2026",
    shipToState: "Uttar Pradesh",
    transactionType: "Shipment",
    invoiceAmount: "₹3,540.00",
    taxRate: "18%",
    hsn: "851762",
    platform: "Flipkart",
  },
  {
    orderId: "FK-77120946",
    invoiceDate: "21-08-2026",
    shipToState: "Gujarat",
    transactionType: "Shipment",
    invoiceAmount: "₹1,416.00",
    taxRate: "18%",
    hsn: "851762",
    platform: "Flipkart",
  },
  {
    orderId: "408-7724190-1156",
    invoiceDate: "28-08-2026",
    shipToState: "Karnataka",
    transactionType: "Shipment",
    invoiceAmount: "₹2,100.00",
    taxRate: "5%",
    hsn: "640399",
    platform: "Amazon",
  },
];

const STATE_NAME: Record<string, string> = {
  "29": "Karnataka",
  "27": "Maharashtra",
  "07": "Delhi",
  "33": "Tamil Nadu",
  "09": "Uttar Pradesh",
  "24": "Gujarat",
};

interface Spec {
  invoiceNumber: string;
  date: string;
  pos: string;
  rate: number;
  /** Net taxable value after any refund on the same order has been applied. */
  taxable: number;
  hsn: string;
  platform: string;
  qty: number;
}

/**
 * The pipeline's output: refunds netted into their original shipment, states
 * coded, rates numeric, tax split by place of supply against the seller's own
 * state. Ten raw lines collapse to eight invoice rows.
 */
const SPECS: Spec[] = [
  {
    invoiceNumber: "AMZ-2026-0801",
    date: "2026-08-03",
    pos: "29",
    rate: 18,
    taxable: 1000,
    hsn: "610910",
    platform: "Amazon",
    qty: 2,
  },
  // 1000 + 2000 − 1000 refund
  {
    invoiceNumber: "AMZ-2026-0802",
    date: "2026-08-05",
    pos: "27",
    rate: 18,
    taxable: 2000,
    hsn: "610910",
    platform: "Amazon",
    qty: 4,
  },
  {
    invoiceNumber: "AMZ-2026-0803",
    date: "2026-08-11",
    pos: "07",
    rate: 5,
    taxable: 500,
    hsn: "640399",
    platform: "Amazon",
    qty: 1,
  },
  // 2000 − 500 refund
  {
    invoiceNumber: "MEE-2026-0801",
    date: "2026-08-12",
    pos: "33",
    rate: 5,
    taxable: 1500,
    hsn: "640399",
    platform: "Meesho",
    qty: 3,
  },
  {
    invoiceNumber: "FLK-2026-0801",
    date: "2026-08-16",
    pos: "09",
    rate: 18,
    taxable: 3000,
    hsn: "851762",
    platform: "Flipkart",
    qty: 1,
  },
  {
    invoiceNumber: "FLK-2026-0802",
    date: "2026-08-21",
    pos: "24",
    rate: 18,
    taxable: 1200,
    hsn: "851762",
    platform: "Flipkart",
    qty: 1,
  },
  {
    invoiceNumber: "AMZ-2026-0804",
    date: "2026-08-28",
    pos: "29",
    rate: 5,
    taxable: 2000,
    hsn: "640399",
    platform: "Amazon",
    qty: 4,
  },
  {
    invoiceNumber: "AMZ-2026-0805",
    date: "2026-08-30",
    pos: "29",
    rate: 18,
    taxable: 800,
    hsn: "610910",
    platform: "Amazon",
    qty: 2,
  },
];

function buildRow(spec: Spec, index: number): NormalizedInvoiceRow {
  const intra = spec.pos === DEMO_SELLER.stateCode;
  const half = spec.rate / 2;
  const cgst = intra ? +(spec.taxable * (half / 100)).toFixed(2) : 0;
  const sgst = cgst;
  const igst = intra ? 0 : +(spec.taxable * (spec.rate / 100)).toFixed(2);

  return {
    id: `demo-${index + 1}`,
    rowIndex: index + 1,
    sourcePlatformId: spec.platform.toLowerCase(),
    sourcePlatformName: spec.platform,
    sourceFileName: DEMO_SELLER.sourceFile,
    transactionType: "Sales",
    invoiceNumber: spec.invoiceNumber,
    invoiceDate: spec.date,
    invoiceType: "B2CS",
    buyerName: "Unregistered buyer",
    buyerGstin: "",
    placeOfSupply: spec.pos,
    hsnCode: spec.hsn,
    itemDescription:
      spec.hsn === "610910"
        ? "Cotton T-shirt"
        : spec.hsn === "640399"
          ? "Footwear"
          : "Wireless earbuds",
    uqc: "PCS",
    quantity: spec.qty,
    taxableValue: spec.taxable,
    cgstRate: intra ? half : 0,
    sgstRate: intra ? half : 0,
    igstRate: intra ? 0 : spec.rate,
    cessRate: 0,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    cessAmount: 0,
    totalValue: +(spec.taxable + cgst + sgst + igst).toFixed(2),
    errors: [],
  };
}

/** Filing-ready rows, fed straight into the production generators. */
export const DEMO_ROWS: NormalizedInvoiceRow[] = SPECS.map(buildRow);

const sum = (pick: (r: NormalizedInvoiceRow) => number) =>
  +DEMO_ROWS.reduce((t, r) => t + pick(r), 0).toFixed(2);

export const DEMO_TOTALS = {
  rawLineCount: RAW_ROWS.length,
  outputLineCount: DEMO_ROWS.length,
  refundsNetted: 1705, // ₹1,180 + ₹525 gross
  netTaxable: sum((r) => r.taxableValue),
  totalTax: sum((r) => r.cgstAmount + r.sgstAmount + r.igstAmount),
  grossValue: sum((r) => r.totalValue),
  states: new Set(DEMO_ROWS.map((r) => r.placeOfSupply)).size,
  platforms: new Set(DEMO_ROWS.map((r) => r.sourcePlatformName)).size,
};

/** Grouped B2CS view (GSTR-1 table 7) shown in the before/after comparison. */
export interface Gstr1Row {
  placeOfSupply: string;
  rate: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  netted?: boolean;
}

export const GSTR1_ROWS: Gstr1Row[] = Object.values(
  DEMO_ROWS.reduce<Record<string, Gstr1Row>>((acc, r) => {
    const key = `${r.placeOfSupply}-${r.igstRate || r.cgstRate * 2}`;
    const rate = r.igstRate || r.cgstRate * 2;
    acc[key] ??= {
      placeOfSupply: `${r.placeOfSupply}-${STATE_NAME[r.placeOfSupply] ?? ""}`,
      rate,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      netted: r.placeOfSupply === "27" || r.placeOfSupply === "33",
    };
    const g = acc[key]!;
    g.taxableValue = +(g.taxableValue + r.taxableValue).toFixed(2);
    g.igst = +(g.igst + r.igstAmount).toFixed(2);
    g.cgst = +(g.cgst + r.cgstAmount).toFixed(2);
    g.sgst = +(g.sgst + r.sgstAmount).toFixed(2);
    return acc;
  }, {})
).sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply));

/** The transformations worth calling out beside the diff. */
export const TRANSFORMATIONS = [
  {
    id: "state",
    label: "State names → GSTN codes",
    detail: '"maharashtra " and "TAMILNADU" became 27 and 33 — trimmed, cased and coded.',
  },
  {
    id: "net",
    label: "Sales returns netted off",
    detail: "₹1,705 of refunds were matched to their original shipments and subtracted.",
  },
  {
    id: "tax",
    label: "Tax extracted from gross",
    detail: "Tax-inclusive invoice values split into taxable value and tax.",
  },
  {
    id: "split",
    label: "IGST vs CGST + SGST resolved",
    detail: "Place of supply compared against the seller's state on every line.",
  },
  {
    id: "merge",
    label: "Three marketplaces merged",
    detail: "Amazon, Meesho and Flipkart exports combined into one return.",
  },
  {
    id: "group",
    label: "Grouped into GSTR-1 tables",
    detail: `${RAW_ROWS.length} raw lines became ${DEMO_ROWS.length} invoice rows across ${new Set(DEMO_ROWS.map((r) => r.placeOfSupply)).size} states.`,
  },
];

export const PIPELINE_STAGES = [
  "Reading workbooks",
  "Detecting marketplace formats",
  "Mapping columns",
  "Normalising states & rates",
  "Netting sales returns",
  "Merging across marketplaces",
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
