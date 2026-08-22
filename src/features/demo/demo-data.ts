import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

export interface DemoMarketplacePreset {
  id: "all" | "amazon" | "meesho" | "flipkart" | "custom";
  name: string;
  badge: string;
  sourceFileName: string;
  sellerState: string;
  sellerGstin: string;
  description: string;
  rawRows: RawRow[];
  specs: Spec[];
}

export const DEMO_SELLER = {
  gstin: "29AABCU9603R1ZX",
  legalName: "Nova Retail Ventures Pvt Ltd",
  stateCode: "29",
  stateName: "Karnataka",
  returnPeriod: "082026",
  returnPeriodLabel: "August 2026",
  sourceFile: "Amazon_Meesho_Flipkart_Aug2026.xlsx",
} as const;

export interface RawRow {
  orderId: string;
  invoiceDate: string;
  shipToState: string;
  transactionType: "Shipment" | "Refund";
  invoiceAmount: string;
  taxRate: string;
  hsn: string;
  platform: string;
}

export interface Spec {
  invoiceNumber: string;
  date: string;
  pos: string;
  rate: number;
  taxable: number;
  hsn: string;
  platform: string;
  qty: number;
}

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

export const STATE_NAMES: Record<string, string> = {
  "29": "Karnataka",
  "27": "Maharashtra",
  "07": "Delhi",
  "33": "Tamil Nadu",
  "09": "Uttar Pradesh",
  "24": "Gujarat",
  "19": "West Bengal",
  "08": "Rajasthan",
  "06": "Haryana",
  "36": "Telangana",
};

export const SPECS: Spec[] = [
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

export const MARKETPLACE_PRESETS: DemoMarketplacePreset[] = [
  {
    id: "all",
    name: "Combined Marketplaces",
    badge: "Multi-Platform",
    sourceFileName: "Multi_Platform_Aug2026.xlsx",
    sellerState: "29",
    sellerGstin: "29AABCU9603R1ZX",
    description: "Amazon MTR v3 + Meesho Sales & Returns + Flipkart Orders merged into 1 return.",
    rawRows: RAW_ROWS,
    specs: SPECS,
  },
  {
    id: "amazon",
    name: "Amazon MTR v3",
    badge: "B2C & B2B",
    sourceFileName: "Amazon_MTR_Aug2026.xlsx",
    sellerState: "29",
    sellerGstin: "29AABCU9603R1ZX",
    description: "Merchant Tax Report with shipments, return credit notes, and state place of supply.",
    rawRows: RAW_ROWS.filter((r) => r.platform === "Amazon"),
    specs: SPECS.filter((s) => s.platform === "Amazon"),
  },
  {
    id: "meesho",
    name: "Meesho GST Report",
    badge: "Sales & Returns",
    sourceFileName: "Meesho_GST_Aug2026.xlsx",
    sellerState: "29",
    sellerGstin: "29AABCU9603R1ZX",
    description: "Forward sales matched against supplier return debits with Section 52 TCS.",
    rawRows: RAW_ROWS.filter((r) => r.platform === "Meesho"),
    specs: SPECS.filter((s) => s.platform === "Meesho"),
  },
  {
    id: "flipkart",
    name: "Flipkart Order Export",
    badge: "Order Level",
    sourceFileName: "Flipkart_Sales_Aug2026.csv",
    sellerState: "29",
    sellerGstin: "29AABCU9603R1ZX",
    description: "Order-level taxable value, CGST/SGST/IGST breakdown, and TCS rate deduction.",
    rawRows: RAW_ROWS.filter((r) => r.platform === "Flipkart"),
    specs: SPECS.filter((s) => s.platform === "Flipkart"),
  },
];

export function buildRow(spec: Spec, index: number): NormalizedInvoiceRow {
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

export const DEMO_ROWS: NormalizedInvoiceRow[] = SPECS.map(buildRow);

const sum = (pick: (r: NormalizedInvoiceRow) => number) =>
  +DEMO_ROWS.reduce((t, r) => t + pick(r), 0).toFixed(2);

export const DEMO_TOTALS = {
  rawLineCount: RAW_ROWS.length,
  outputLineCount: DEMO_ROWS.length,
  refundsNetted: 1705,
  netTaxable: sum((r) => r.taxableValue),
  totalTax: sum((r) => r.cgstAmount + r.sgstAmount + r.igstAmount),
  grossValue: sum((r) => r.totalValue),
  states: new Set(DEMO_ROWS.map((r) => r.placeOfSupply)).size,
  platforms: new Set(DEMO_ROWS.map((r) => r.sourcePlatformName)).size,
};

export interface Gstr1Row {
  placeOfSupply: string;
  rate: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  netned?: boolean;
}

export interface EcoRow {
  ecoName: string;
  ecoGstin: string;
  grossSales: number;
  returnsNetted: number;
  netTaxable: number;
  tcsDeducted: number;
}

export const DEMO_ECO_ROWS: EcoRow[] = [
  {
    ecoName: "Amazon Seller Services Pvt Ltd",
    ecoGstin: "29AABCA1234F1ZX",
    grossSales: 7350,
    returnsNetted: 1180,
    netTaxable: 6170,
    tcsDeducted: 61.7,
  },
  {
    ecoName: "Fashnear Technologies (Meesho)",
    ecoGstin: "29AAACF9876Q1Z2",
    grossSales: 2100,
    returnsNetted: 525,
    netTaxable: 1575,
    tcsDeducted: 15.75,
  },
  {
    ecoName: "Flipkart Internet Pvt Ltd",
    ecoGstin: "29AACCF4567P1Z8",
    grossSales: 4956,
    returnsNetted: 0,
    netTaxable: 4200,
    tcsDeducted: 42.0,
  },
];

export interface HsnSummaryRow {
  hsnCode: string;
  description: string;
  uqc: string;
  quantity: number;
  taxableValue: number;
  rate: number;
  taxAmount: number;
}

export const DEMO_HSN_ROWS: HsnSummaryRow[] = [
  {
    hsnCode: "610910",
    description: "Cotton T-shirts / Garments",
    uqc: "PCS",
    quantity: 8,
    taxableValue: 3800,
    rate: 18,
    taxAmount: 684,
  },
  {
    hsnCode: "640399",
    description: "Footwear / Shoes",
    uqc: "PAIR",
    quantity: 8,
    taxableValue: 4000,
    rate: 5,
    taxAmount: 200,
  },
  {
    hsnCode: "851762",
    description: "Electronic Goods / Earbuds",
    uqc: "PCS",
    quantity: 2,
    taxableValue: 4200,
    rate: 18,
    taxAmount: 756,
  },
];

export const GSTR1_ROWS: Gstr1Row[] = Object.values(
  DEMO_ROWS.reduce<Record<string, Gstr1Row>>((acc, r) => {
    const key = `${r.placeOfSupply}-${r.igstRate || r.cgstRate * 2}`;
    const rate = r.igstRate || r.cgstRate * 2;
    acc[key] ??= {
      placeOfSupply: `${r.placeOfSupply}-${STATE_NAMES[r.placeOfSupply] ?? ""}`,
      rate,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      netned: r.placeOfSupply === "27" || r.placeOfSupply === "33",
    };
    const g = acc[key]!;
    g.taxableValue = +(g.taxableValue + r.taxableValue).toFixed(2);
    g.igst = +(g.igst + r.igstAmount).toFixed(2);
    g.cgst = +(g.cgst + r.cgstAmount).toFixed(2);
    g.sgst = +(g.sgst + r.sgstAmount).toFixed(2);
    return acc;
  }, {})
).sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply));

export const TRANSFORMATIONS = [
  {
    id: "state",
    label: "State names → Official GSTN codes",
    detail: '"maharashtra " and "TAMILNADU" became 27 and 33 — trimmed, cased and coded.',
  },
  {
    id: "net",
    label: "Sales returns netted off",
    detail: "₹1,705 of refunds were matched to original shipments and subtracted.",
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
    id: "eco",
    label: "Table 14 E-Commerce summary",
    detail: "TCS under Section 52 grouped per marketplace operator GSTIN.",
  },
  {
    id: "hsn",
    label: "Table 12 HSN Summary grouped",
    detail: "HSN codes, standard UQC units, quantities and tax totals formatted.",
  },
];

export const PIPELINE_STAGES = [
  "Reading marketplace workbooks",
  "Auto-detecting report format (Amazon / Meesho / Flipkart)",
  "Mapping columns & dates",
  "Normalising states & rates",
  "Netting return credit notes against forward sales",
  "Merging across multi-channel marketplaces",
  "Splitting IGST / CGST / SGST",
  "Generating Table 7 (B2CS), Table 14 (ECO) & Table 12 (HSN)",
  "Building Government-ready JSON & Excel",
];

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatInr(value: number): string {
  return INR.format(value);
}
