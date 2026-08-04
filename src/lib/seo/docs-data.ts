export interface DocItem {
  slug: string;
  title: string;
  category: "Getting Started" | "Platform Guides" | "Core Engine" | "Troubleshooting";
  description: string;
  metaTitle: string;
  metaDescription: string;
  readTime: string;
  content: string; // Markdown / HTML content string
}

export const DOCS_DATA: Record<string, DocItem> = {
  "getting-started": {
    slug: "getting-started",
    title: "Getting Started with GSTPilot",
    category: "Getting Started",
    description:
      "Learn how to convert marketplace Excel reports to government-compatible GSTR-1 JSON & Excel files.",
    metaTitle: "Getting Started Guide | GSTPilot Documentation",
    metaDescription:
      "Quickstart guide to convert marketplace Excel reports to GSTR-1 JSON & Excel files with GSTPilot.",
    readTime: "3 min read",
    content: `
# Getting Started with GSTPilot

GSTPilot is a specialized SaaS tool built exclusively for e-commerce sellers, CA firms, and accounting teams to convert marketplace reports (Amazon, Flipkart, Meesho, Myntra, etc.) into official government-compatible **GSTR-1 JSON** and multi-sheet **Excel** workbooks.

---

## The 10-Step Workflow

1. **Step 1 — GST Profile**: Select your registered GSTIN profile.
2. **Step 2 — Return Period**: Choose the tax filing month (e.g. July 2025).
3. **Step 3 — Marketplaces**: Select one or multiple platforms (e.g., Amazon + Meesho + Flipkart).
4. **Step 4 — Required Files Check**: Rule Engine verifies required report slots.
5. **Step 5 — Upload Reports**: Drop your files into platform slots.
6. **Step 6 — Column Mapping**: Verify auto-detected headers or customize column mappings.
7. **Step 7 — Pipeline Processing**: 8-stage processing normalizes values and merges data.
8. **Step 8 — Smart Error Resolution & TCS**: Fix row errors inline, use Auto-Fixers, or reconcile state TCS.
9. **Step 9 — Final Review & Approval**: Review Net Sales summary and approve return figures.
10. **Step 10 — Download & Save**: Download GSTN v3.0 JSON & Excel files and save history.
`,
  },

  "how-to-upload-amazon-b2b-report": {
    slug: "how-to-upload-amazon-b2b-report",
    title: "How to Upload Amazon MTR (B2B & B2C) Reports",
    category: "Platform Guides",
    description:
      "Step-by-step guide to download and process Amazon Merchant Tax Reports in GSTPilot.",
    metaTitle: "Amazon MTR B2B & B2C Upload Guide | GSTPilot Docs",
    metaDescription:
      "Step-by-step guide to export Amazon Merchant Tax Reports and generate GSTR-1 JSON & Excel.",
    readTime: "4 min read",
    content: `
# How to Upload Amazon MTR (B2B & B2C) Reports

Amazon exports sales reports as **Merchant Tax Reports (MTR)** in Seller Central.

---

## Step-by-Step Instructions

1. Log into **Amazon Seller Central India**.
2. Navigate to **Reports → Tax Document Library → Merchant Tax Report (MTR)**.
3. Select your filing month and download the **B2B Tax Report** and **B2C Tax Report**.
4. Open GSTPilot, select **Amazon Seller MTR** as your platform.
5. Drop your B2B report into the required B2B slot, and optional B2C/Credit Notes reports into their slots.
6. GSTPilot's Auto-Detection Engine will verify your files and normalize headers automatically.
`,
  },

  "how-to-upload-meesho-sales-report": {
    slug: "how-to-upload-meesho-sales-report",
    title: "How to Upload Meesho Sales & Sales Return Reports",
    category: "Platform Guides",
    description: "Learn how to process Meesho Supplier Panel Sales and Return files together.",
    metaTitle: "Meesho Sales & Return Upload Guide | GSTPilot Docs",
    metaDescription:
      "Learn how to upload Meesho Sales and Return files together for automatic Net Sales calculation.",
    readTime: "4 min read",
    content: `
# How to Upload Meesho Sales & Sales Return Reports

Meesho issues two separate exports on the Supplier Panel:
1. **Sales Report** (Delivered Orders)
2. **Sales Return Report** (Returned Orders & Refunds)

---

## Why Upload Both Reports?

Uploading both reports allows GSTPilot's Net Sales Engine to calculate \`Net Sales = Gross Sales - Sales Returns\`, ensuring you never overpay tax on returned goods.
`,
  },

  "how-to-fix-gstin-errors": {
    slug: "how-to-fix-gstin-errors",
    title: "How to Fix GSTIN & HSN Errors in Smart Error Resolution Center",
    category: "Core Engine",
    description:
      "Fix row errors inline or use 1-click Auto-Fixers without re-uploading Excel files.",
    metaTitle: "Smart Error Resolution & Auto-Fixers Guide | GSTPilot Docs",
    metaDescription:
      "Learn how to edit row errors inline and use Auto-Fixers to resolve GSTIN, POS, and HSN errors.",
    readTime: "3 min read",
    content: `
# Smart Error Resolution Center Guide

GSTPilot includes a **Smart Error Resolution Center** (Step 8) that lets you fix data errors inline without editing raw Excel files.

---

## 1-Click Auto-Fixers

Click **Auto-Fix Data Issues** to automatically:
- Trim leading/trailing spaces and uppercase GSTIN strings.
- Derive Place of Supply state codes from 2-digit GSTIN prefixes.
- Strip non-digit characters from HSN codes.
`,
  },

  "how-to-reconcile-tcs": {
    slug: "how-to-reconcile-tcs",
    title: "How to Reconcile TCS with GST Portal Exports",
    category: "Core Engine",
    description: "Compare state-wise Net Sales against official GST Portal TCS Excel exports.",
    metaTitle: "TCS Reconciliation Guide | GSTPilot Docs",
    metaDescription: "Learn how to compare state-wise GSTR-1 sales against GST Portal TCS exports.",
    readTime: "4 min read",
    content: `
# How to Reconcile TCS with GST Portal Exports

GSTPortal requires matching sales figures reported by marketplaces under Section 52 (TCS).

---

## Workflow

1. Download your **TCS Credit Received** report from the GST Portal.
2. In Step 8 of GSTPilot, switch to the **TCS Reconciliation** tab.
3. Upload the GST Portal TCS Excel file.
4. GSTPilot compares state-wise net sales and tax amounts, highlighting differences.
`,
  },

  "how-to-generate-gstr1-json": {
    slug: "how-to-generate-gstr1-json",
    title: "How to Generate & Upload Official GSTR-1 JSON",
    category: "Core Engine",
    description: "Download GSTN v3.0 compliant JSON files for direct portal upload.",
    metaTitle: "GSTR-1 JSON Generation & Portal Upload Guide | GSTPilot Docs",
    metaDescription:
      "Guide to generate and upload GSTN v3.0 compatible JSON files to GST Offline Tool & Portal.",
    readTime: "3 min read",
    content: `
# How to Generate & Upload Official GSTR-1 JSON

GSTPilot produces government-compliant **GSTN v3.0+ JSON** payloads.

---

## Uploading to GST Portal

1. Download the \`.json\` file from Step 10.
2. Open **GST Offline Tool v3.0+** or log into [gst.gov.in](https://www.gst.gov.in).
3. Navigate to **Returns → GSTR-1 → Upload JSON**.
4. Select the downloaded JSON file to populate B2B, B2CL, B2CS, CDNR, HSN, and Document tables.
`,
  },
};
