export interface PlatformFileConfig {
  id: string; // e.g. "sales", "returns", "b2b", "b2c", "credit_notes"
  name: string; // e.g. "Sales Report"
  description: string;
  required: boolean;
  fileTypes: string[]; // [".xlsx", ".xls", ".csv"]
  headerKeywords?: string[];
}

export interface PlatformConfig {
  id: string;
  name: string;
  description: string;
  iconName: string;
  badge: string;
  accentColor: string;
  files: PlatformFileConfig[];
}

export const PLATFORMS_CONFIG: PlatformConfig[] = [
  {
    id: "amazon",
    name: "Amazon Seller MTR",
    description: "Amazon Merchant Tax Report (MTR) B2B & B2C GST reports",
    iconName: "ShoppingBag",
    badge: "Amazon MTR",
    accentColor: "from-amber-500 to-orange-600",
    files: [
      {
        id: "b2b",
        name: "B2B Report / Tax Report",
        description: "Amazon Merchant Tax Report (B2B Tax Report)",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: [
          "mtr",
          "shipment_item_id",
          "customer_bill_to_gstid",
          "tax_exclusive_gross",
          "principal_amount",
          "seller_gstin",
        ],
      },
      {
        id: "b2c",
        name: "B2C Report (Optional if B2B includes all)",
        description: "Amazon B2C Tax Report or Order Report",
        required: false,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: [
          "mtr",
          "shipment_item_id",
          "tax_exclusive_gross",
          "principal_amount",
          "seller_gstin",
        ],
      },
      {
        id: "credit_notes",
        name: "Credit Notes Report",
        description: "Returns & Refund Credit Notes report",
        required: false,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: ["mtr", "credit_note", "refund"],
      },
    ],
  },
  {
    id: "meesho",
    name: "Meesho Supplier Panel",
    description: "Meesho Supplier Panel Sales & Sales Return Reports",
    iconName: "Store",
    badge: "Meesho",
    accentColor: "from-pink-500 to-rose-600",
    files: [
      {
        id: "sales",
        name: "Sales Report",
        description: "Meesho Supplier Tax / Sales Report",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: [
          "sub_order_num",
          "sub_order_no",
          "total_taxable_sale_value",
          "end_customer_state_new",
          "eco_tcs_gstin",
          "tcs",
        ],
      },
      {
        id: "returns",
        name: "Sales Return Report",
        description: "Meesho Return & Refund Report",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: [
          "sub_order_num",
          "sub_order_no",
          "cancel_return_date",
          "total_taxable_sale_value",
          "end_customer_state_new",
          "eco_tcs_gstin",
        ],
      },
    ],
  },
  {
    id: "flipkart",
    name: "Flipkart Seller Hub",
    description: "Flipkart Seller Hub Sales & Return Tax Reports",
    iconName: "ShoppingCart",
    badge: "Flipkart Hub",
    accentColor: "from-blue-500 to-indigo-600",
    files: [
      {
        id: "sales",
        name: "Sales Report",
        description: "Flipkart Seller Tax / Sales Report",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: ["invoice_id", "customer_state", "taxable_value"],
      },
      {
        id: "returns",
        name: "Returns Report",
        description: "Flipkart Return / Credit Note Report",
        required: false,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: ["return", "credit_note"],
      },
    ],
  },
  {
    id: "jiomart",
    name: "JioMart Partner",
    description: "JioMart Partner Tax & Order Invoices",
    iconName: "Store",
    badge: "JioMart",
    accentColor: "from-blue-600 to-indigo-700",
    files: [
      {
        id: "sales",
        name: "Sales & Tax Report",
        description: "JioMart Partner Orders Tax Report",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: ["invoice_number", "taxable_value"],
      },
    ],
  },
  {
    id: "shopdeck",
    name: "Shopdeck Seller",
    description: "Shopdeck D2C orders and GST exports",
    iconName: "ShoppingBag",
    badge: "Shopdeck",
    accentColor: "from-blue-500 to-cyan-600",
    files: [
      {
        id: "sales",
        name: "Orders & Sales Report",
        description: "Shopdeck Sales & GST report",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: ["order_id", "subtotal"],
      },
    ],
  },
  {
    id: "glowroad",
    name: "GlowRoad Seller",
    description: "GlowRoad Reseller GST Sales Reports",
    iconName: "Sparkles",
    badge: "GlowRoad",
    accentColor: "from-emerald-500 to-teal-600",
    files: [
      {
        id: "sales",
        name: "GST Sales Report",
        description: "GlowRoad Seller GST Sales Report",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: ["order_no", "taxable_amount"],
      },
      {
        id: "returns",
        name: "Return / Credit Notes Report",
        description: "GlowRoad Return Report",
        required: false,
        fileTypes: [".xlsx", ".xls", ".csv"],
      },
    ],
  },
  {
    id: "myntra",
    name: "Myntra Partner Portal",
    description: "Myntra Partner Portal GST reports",
    iconName: "ShoppingBag",
    badge: "Myntra",
    accentColor: "from-rose-500 to-red-600",
    files: [
      {
        id: "sales",
        name: "Tax Sales Report",
        description: "Myntra GST Sales Report",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
        headerKeywords: ["invoice_no", "place_of_supply"],
      },
    ],
  },
  {
    id: "snapdeal",
    name: "Snapdeal Seller",
    description: "Snapdeal Seller Panel order & tax reports",
    iconName: "Package",
    badge: "Snapdeal",
    accentColor: "from-red-600 to-orange-500",
    files: [
      {
        id: "sales",
        name: "Sales & Tax Report",
        description: "Snapdeal Orders Report",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
      },
    ],
  },
  {
    id: "roposo",
    name: "Roposo Clout",
    description: "Roposo Clout seller sales & return reports",
    iconName: "Zap",
    badge: "Roposo",
    accentColor: "from-violet-500 to-purple-600",
    files: [
      {
        id: "sales",
        name: "Sales Report",
        description: "Roposo Clout Sales Report",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
      },
    ],
  },
  {
    id: "custom",
    name: "Custom Excel / CSV",
    description: "Upload any custom sales or returns spreadsheet",
    iconName: "FileSpreadsheet",
    badge: "Custom",
    accentColor: "from-slate-500 to-gray-600",
    files: [
      {
        id: "custom_file",
        name: "Excel / CSV File",
        description: "Any custom formatted sales/returns Excel or CSV",
        required: true,
        fileTypes: [".xlsx", ".xls", ".csv"],
      },
    ],
  },
];

export function getPlatformConfig(platformId: string): PlatformConfig {
  const config = PLATFORMS_CONFIG.find((p) => p.id === platformId);
  return config ?? PLATFORMS_CONFIG[PLATFORMS_CONFIG.length - 1]!;
}
