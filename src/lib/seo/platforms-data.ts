export interface PlatformSeoItem {
  slug: string;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  supportedReports: string[];
  requiredFiles: { name: string; required: boolean; description: string }[];
  keyFeatures: string[];
  workflowSteps: string[];
  faqs: { question: string; answer: string }[];
  commonIssues: { title: string; description: string; resolution: string }[];
}

export const PLATFORMS_SEO_DATA: Record<string, PlatformSeoItem> = {
  "amazon-gst-report-generator": {
    slug: "amazon-gst-report-generator",
    name: "Amazon Seller MTR GST Report Converter",
    badge: "Amazon MTR v3.0",
    tagline:
      "Convert Amazon Merchant Tax Reports (B2B & B2C) to Government GSTR-1 Excel & JSON in seconds.",
    description:
      "Automate your Amazon GST filing. GSTPilot parses Amazon Merchant Tax Reports (MTR B2B, B2C & Credit Notes), calculates net sales, handles returns, and generates official GSTN-compatible GSTR-1 JSON and multi-sheet Excel files.",
    metaTitle: "Amazon GST Report Generator & MTR to GSTR-1 Converter | GSTPilot",
    metaDescription:
      "Convert Amazon Seller MTR B2B & B2C reports to GSTR-1 JSON & Excel. Auto-calculate net sales, handle credit notes, and file error-free.",
    supportedReports: [
      "Merchant Tax Report (MTR B2B)",
      "Merchant Tax Report (MTR B2C)",
      "Amazon Returns & Credit Notes Report",
      "Merchant Tax Report v3 (2025)",
    ],
    requiredFiles: [
      {
        name: "B2B Report / Tax Report",
        required: true,
        description: "Amazon Merchant Tax Report B2B Tax Report file (.xlsx / .csv)",
      },
      { name: "B2C Report", required: false, description: "Amazon B2C Tax Report or Order Report" },
      {
        name: "Credit Notes Report",
        required: false,
        description: "Amazon Returns & Refund Credit Notes report",
      },
    ],
    keyFeatures: [
      "Automatic B2B vs B2CS classification",
      "Net sales calculation (Sales - Returns = Net Sales)",
      "State-wise place of supply mapping",
      "Auto-derive GSTIN state codes",
      "Instant GSTN v3.0 JSON download",
    ],
    workflowSteps: [
      "Download your Merchant Tax Report (MTR) from Amazon Seller Central.",
      "Upload the file to GSTPilot's Amazon Converter.",
      "Review the auto-calculated Net Sales summary and state breakdown.",
      "Download official GSTR-1 JSON and multi-sheet Excel for GST Portal upload.",
    ],
    faqs: [
      {
        question: "Does GSTPilot support the latest Amazon MTR v3 format?",
        answer:
          "Yes, GSTPilot automatically detects all Amazon MTR report versions (v1, v2, v3) and normalizes column headers automatically.",
      },
      {
        question: "How are Amazon returns and credit notes handled?",
        answer:
          "Returns with buyer GSTIN or original invoice numbers are mapped to CDNR (Credit Notes), while consumer returns auto-adjust B2CS state taxable totals.",
      },
    ],
    commonIssues: [
      {
        title: "Missing HSN codes in raw Amazon MTR export",
        description:
          "GSTPilot automatically applies default 6-digit HSN codes (e.g. 998313 or product HSN) if missing in raw Amazon reports.",
        resolution:
          "Use GSTPilot's Smart Error Resolution Center to auto-fix missing HSN codes in one click.",
      },
    ],
  },

  "meesho-gst-report-generator": {
    slug: "meesho-gst-report-generator",
    name: "Meesho Supplier Panel GST Report Converter",
    badge: "Meesho Supplier Hub",
    tagline: "Combine Meesho Sales and Sales Return reports into 1 clean GSTR-1 filing.",
    description:
      "Filing GST for Meesho sellers made easy. GSTPilot processes Meesho Supplier Tax reports and Sales Return files, calculates true net sales, and outputs valid GSTR-1 JSON and Excel files.",
    metaTitle: "Meesho GST Report Converter & Sales Return Calculator | GSTPilot",
    metaDescription:
      "Convert Meesho Supplier Panel sales and sales return Excel reports to GSTR-1 JSON & Excel with net sales calculation.",
    supportedReports: [
      "Meesho Supplier Sales Report",
      "Meesho Sales Return Report",
      "Meesho Tax Invoice Report",
    ],
    requiredFiles: [
      {
        name: "Sales Report",
        required: true,
        description: "Meesho Supplier Tax / Sales Report (.xlsx / .csv)",
      },
      {
        name: "Sales Return Report",
        required: true,
        description: "Meesho Return & Refund Report (.xlsx / .csv)",
      },
    ],
    keyFeatures: [
      "Automatic Sales - Returns = Net Sales deduction",
      "Multi-file Meesho report merging",
      "HSN code sanitization",
      "State-wise consumer sales consolidation",
    ],
    workflowSteps: [
      "Export Sales Report and Sales Return Report from Meesho Supplier Panel.",
      "Drag and drop both reports into GSTPilot's Meesho slot.",
      "GSTPilot merges both files and calculates true Net Sales.",
      "Download GSTR-1 JSON for direct GST Portal upload.",
    ],
    faqs: [
      {
        question: "Why do I need to upload both Meesho Sales and Return files?",
        answer:
          "Meesho issues separate files for delivered sales and returned orders. Uploading both ensures you only pay tax on true Net Sales.",
      },
    ],
    commonIssues: [
      {
        title: "Negative taxable values in Meesho return files",
        description:
          "GSTPilot's Net Sales Engine automatically deducts return values from gross sales without generating tax calculation errors.",
        resolution: "Upload both Sales and Return files together for automatic net calculation.",
      },
    ],
  },

  "flipkart-gst-report-generator": {
    slug: "flipkart-gst-report-generator",
    name: "Flipkart Seller Hub GST Report Converter",
    badge: "Flipkart Seller Hub",
    tagline: "Seamlessly convert Flipkart Seller Hub GST sales exports to GSTR-1.",
    description:
      "Simplify your Flipkart GST returns. Upload Flipkart Seller Hub sales and return reports to generate government-compliant GSTR-1 JSON and multi-sheet Excel workbooks.",
    metaTitle: "Flipkart GST Report Generator & Tax Converter | GSTPilot",
    metaDescription:
      "Convert Flipkart Seller Hub GST sales & return reports to official GSTR-1 JSON and Excel formats in seconds.",
    supportedReports: ["Flipkart Seller GST Sales Report", "Flipkart Return & Credit Note Report"],
    requiredFiles: [
      {
        name: "Sales Report",
        required: true,
        description: "Flipkart Seller Tax / Sales Report (.xlsx / .csv)",
      },
      {
        name: "Returns Report",
        required: false,
        description: "Flipkart Return / Credit Note Report",
      },
    ],
    keyFeatures: [
      "Flipkart Seller Hub auto column detection",
      "Intra-state vs Inter-state IGST/CGST split",
      "B2B invoice validation",
      "1-click Excel workbook download",
    ],
    workflowSteps: [
      "Download GST Sales Report from Flipkart Seller Hub.",
      "Upload to GSTPilot.",
      "Review state-wise tax breakdown.",
      "Download GSTR-1 JSON & Excel files.",
    ],
    faqs: [
      {
        question: "Does GSTPilot support Flipkart B2B transactions?",
        answer:
          "Yes, all registered B2B invoices with customer GSTINs are separated into GSTR-1 B2B Table 4A.",
      },
    ],
    commonIssues: [
      {
        title: "State code mismatch in Flipkart reports",
        description:
          "GSTPilot automatically derives Place of Supply state codes from delivery addresses or customer GSTIN prefixes.",
        resolution: "GSTPilot auto-normalizes state codes to valid 2-digit GST state numbers.",
      },
    ],
  },

  "myntra-gst-report-generator": {
    slug: "myntra-gst-report-generator",
    name: "Myntra Partner Portal GST Report Converter",
    badge: "Myntra Partner",
    tagline: "Convert Myntra seller partner reports into GSTR-1 JSON & Excel.",
    description:
      "Effortlessly convert Myntra Partner Portal GST sales reports into official government GSTR-1 filings with automatic HSN and place of supply validation.",
    metaTitle: "Myntra GST Report Generator & Partner Portal Converter | GSTPilot",
    metaDescription:
      "Convert Myntra Partner Portal GST sales reports to official GSTR-1 JSON and multi-sheet Excel files.",
    supportedReports: ["Myntra GST Sales Report", "Myntra Return Credit Notes"],
    requiredFiles: [
      {
        name: "Tax Sales Report",
        required: true,
        description: "Myntra GST Sales Report (.xlsx / .csv)",
      },
    ],
    keyFeatures: [
      "Myntra GST header auto-mapping",
      "Integrated & Central tax calculation",
      "HSN 4/6/8-digit validation",
    ],
    workflowSteps: [
      "Export Tax Report from Myntra Partner Portal.",
      "Upload file to GSTPilot.",
      "Download ready-to-file GSTR-1 JSON.",
    ],
    faqs: [
      {
        question: "Can I combine Myntra sales with Amazon & Flipkart in 1 return?",
        answer:
          "Yes! GSTPilot allows uploading Myntra, Amazon, and Flipkart reports simultaneously for a combined monthly GSTR-1 filing.",
      },
    ],
    commonIssues: [
      {
        title: "Unrecognized column headers",
        description:
          "GSTPilot's Universal Mapping Engine auto-detects Myntra headers and maps them to standard GSTR-1 fields.",
        resolution: "Use column mapping preview if custom columns are added by Myntra.",
      },
    ],
  },

  "glowroad-gst-report-generator": {
    slug: "glowroad-gst-report-generator",
    name: "GlowRoad Seller GST Report Converter",
    badge: "GlowRoad",
    tagline: "Process GlowRoad reseller sales reports into GSTR-1 JSON & Excel.",
    description:
      "Convert GlowRoad GST sales reports and reseller returns into government-compliant GSTR-1 filings.",
    metaTitle: "GlowRoad GST Report Generator | GSTPilot",
    metaDescription:
      "Convert GlowRoad reseller sales and return reports to GSTR-1 JSON and multi-sheet Excel.",
    supportedReports: ["GlowRoad GST Sales Report", "GlowRoad Returns Report"],
    requiredFiles: [
      { name: "GST Sales Report", required: true, description: "GlowRoad Seller GST Sales Report" },
    ],
    keyFeatures: [
      "GlowRoad report parsing",
      "Reseller discount net calculations",
      "GSTR-1 JSON export",
    ],
    workflowSteps: ["Download GlowRoad report", "Upload to GSTPilot", "Download GSTR-1 JSON"],
    faqs: [
      {
        question: "Is GlowRoad supported?",
        answer: "Yes, full support for GlowRoad seller GST sales reports.",
      },
    ],
    commonIssues: [
      {
        title: "Missing GSTIN",
        description: "B2C reseller sales are automatically classified into B2CS.",
        resolution: "Auto-classified into B2CS.",
      },
    ],
  },

  "jiomart-gst-report-generator": {
    slug: "jiomart-gst-report-generator",
    name: "JioMart Partner GST Report Converter",
    badge: "JioMart Partner",
    tagline: "Convert JioMart Partner seller reports into GSTR-1 JSON & Excel.",
    description:
      "Upload JioMart Partner order reports and convert them into official GSTN v3.0 JSON and multi-sheet Excel files.",
    metaTitle: "JioMart GST Report Generator | GSTPilot",
    metaDescription:
      "Convert JioMart Partner seller GST reports to official GSTR-1 JSON & Excel format.",
    supportedReports: ["JioMart Orders & Tax Report"],
    requiredFiles: [
      {
        name: "Sales & Tax Report",
        required: true,
        description: "JioMart Partner Orders Tax Report",
      },
    ],
    keyFeatures: ["JioMart header mapping", "Place of supply validation", "Tax math verification"],
    workflowSteps: ["Download JioMart report", "Upload to GSTPilot", "Download GSTR-1"],
    faqs: [{ question: "How fast is conversion?", answer: "Converts in less than 2 seconds." }],
    commonIssues: [
      {
        title: "Tax rounding",
        description: "GSTPilot auto-adjusts rounding tolerance up to ₹2.",
        resolution: "Automatic tax math fix.",
      },
    ],
  },

  "snapdeal-gst-report-generator": {
    slug: "snapdeal-gst-report-generator",
    name: "Snapdeal Seller GST Report Converter",
    badge: "Snapdeal",
    tagline: "Convert Snapdeal Seller Panel tax reports to GSTR-1.",
    description:
      "Parse Snapdeal seller order exports and generate valid GSTR-1 JSON and Excel files.",
    metaTitle: "Snapdeal GST Report Generator | GSTPilot",
    metaDescription:
      "Convert Snapdeal seller tax reports to official GSTR-1 JSON and Excel format.",
    supportedReports: ["Snapdeal Orders Tax Report"],
    requiredFiles: [
      { name: "Sales & Tax Report", required: true, description: "Snapdeal Orders Report" },
    ],
    keyFeatures: ["Snapdeal column mapping", "B2CS consolidation", "JSON export"],
    workflowSteps: ["Download Snapdeal report", "Upload to GSTPilot", "Download JSON"],
    faqs: [{ question: "Does it support Snapdeal?", answer: "Yes, Snapdeal is fully supported." }],
    commonIssues: [
      {
        title: "Duplicate order numbers",
        description: "Merge engine deduplicates duplicate rows.",
        resolution: "Auto-deduplicated.",
      },
    ],
  },

  "shopdeck-gst-report-generator": {
    slug: "shopdeck-gst-report-generator",
    name: "Shopdeck D2C GST Report Converter",
    badge: "Shopdeck",
    tagline: "Convert Shopdeck D2C sales exports into GSTR-1 filings.",
    description:
      "Parse Shopdeck D2C order exports and generate official GSTR-1 JSON and Excel files.",
    metaTitle: "Shopdeck GST Report Generator | GSTPilot",
    metaDescription: "Convert Shopdeck D2C orders and sales reports to GSTR-1 JSON & Excel.",
    supportedReports: ["Shopdeck Orders & Sales Report"],
    requiredFiles: [
      { name: "Orders & Sales Report", required: true, description: "Shopdeck Sales & GST Report" },
    ],
    keyFeatures: ["Shopdeck auto-mapping", "Net sales calculation", "State-wise POS summary"],
    workflowSteps: ["Export Shopdeck report", "Upload to GSTPilot", "Download GSTR-1 JSON"],
    faqs: [
      {
        question: "Supports D2C stores?",
        answer: "Yes, Shopdeck D2C sales exports are supported.",
      },
    ],
    commonIssues: [
      {
        title: "State names instead of codes",
        description: "State names are converted to 2-digit GST state codes.",
        resolution: "Auto state name normalization.",
      },
    ],
  },

  "custom-excel-gst-generator": {
    slug: "custom-excel-gst-generator",
    name: "Custom Excel / CSV Universal GST Mapper",
    badge: "Universal Mapper",
    tagline: "Map and convert ANY sales Excel or CSV spreadsheet to GSTR-1 JSON.",
    description:
      "Have a custom ERP, Tally export, or custom Excel spreadsheet? Use GSTPilot's Universal Mapping Engine to map custom headers and generate official GSTR-1 JSON & Excel files.",
    metaTitle: "Custom Excel to GSTR-1 JSON Converter & Mapper | GSTPilot",
    metaDescription:
      "Convert any custom sales Excel or CSV spreadsheet to official GSTR-1 JSON & Excel with custom column mapping.",
    supportedReports: ["Custom Excel (.xlsx / .xls)", "Custom CSV (.csv)", "ERP Sales Exports"],
    requiredFiles: [
      {
        name: "Excel / CSV File",
        required: true,
        description: "Any custom formatted sales spreadsheet",
      },
    ],
    keyFeatures: [
      "Fuzzy column auto-detection",
      "Interactive column mapping UI",
      "Remember mapping profile in database",
      "JSON profile import & export",
    ],
    workflowSteps: [
      "Upload your custom Excel or CSV spreadsheet.",
      "GSTPilot auto-detects column headers.",
      "Verify or adjust mapped columns in Step 6.",
      "Download official GSTR-1 JSON & Excel.",
    ],
    faqs: [
      {
        question: "Can I save my custom Excel column mapping for future months?",
        answer:
          "Yes! Click 'Remember Mappings' to save your custom mapping profile to your account for future 1-click uploads.",
      },
    ],
    commonIssues: [
      {
        title: "Unmapped required fields",
        description:
          "GSTPilot highlights missing required fields (like Invoice Number or Taxable Value) so you can map them in Step 6.",
        resolution: "Select header binding from dropdown in Step 6.",
      },
    ],
  },
};
