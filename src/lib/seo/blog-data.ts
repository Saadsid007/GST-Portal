export interface BlogPost {
  slug: string;
  title: string;
  category: "Amazon GST" | "Meesho GST" | "Flipkart GST" | "TCS Compliance" | "Guides";
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  publishedDate: string;
  readTime: string;
  author: string;
  content: string;
}

export const BLOG_POSTS_DATA: Record<string, BlogPost> = {
  "gst-guide-for-amazon-sellers": {
    slug: "gst-guide-for-amazon-sellers",
    title: "Complete GST Filing Guide for Amazon India Sellers (2025)",
    category: "Amazon GST",
    excerpt:
      "Everything you need to know about Amazon Merchant Tax Reports (MTR), B2B invoices, returns, and GSTR-1 compliance.",
    metaTitle: "Complete GST Filing Guide for Amazon Sellers (2025) | GSTPilot",
    metaDescription:
      "Learn how to convert Amazon Merchant Tax Reports (MTR) to GSTR-1 JSON & Excel. Step-by-step guide for B2B, B2C, and returns.",
    publishedDate: "2025-07-15",
    readTime: "6 min read",
    author: "GSTPilot Compliance Team",
    content: `
# Complete GST Filing Guide for Amazon India Sellers (2025)

Filing GST as an Amazon India seller requires accurately processing Merchant Tax Reports (MTR) exported from Seller Central.

---

## Key Amazon Reports Needed for GSTR-1

1. **B2B Tax Report**: Contains registered business orders with buyer GSTINs (Table 4A in GSTR-1).
2. **B2C Tax Report**: Contains consumer sales grouped by state (Table 7 B2CS in GSTR-1).
3. **Credit Notes Report**: Contains return adjustments and customer refunds.

---

## Common Pitfalls to Avoid

- Overpaying tax on returned items by ignoring return credit notes.
- Mismatched place of supply state codes.
- Invalid or truncated HSN codes.

GSTPilot automates all these steps in seconds.
`,
  },

  "meesho-sales-returns-gst-filing": {
    slug: "meesho-sales-returns-gst-filing",
    title: "How to File GST for Meesho Sellers: Deducting Sales Returns Correctly",
    category: "Meesho GST",
    excerpt:
      "Don't pay tax on returned orders! Learn how to combine Meesho Sales and Return reports into clean Net Sales.",
    metaTitle: "Meesho GST Filing Guide: Sales & Return Deduction | GSTPilot",
    metaDescription:
      "Step-by-step guide for Meesho sellers to process sales and return reports into GSTR-1 with Net Sales calculation.",
    publishedDate: "2025-07-20",
    readTime: "5 min read",
    author: "GSTPilot Compliance Team",
    content: `
# How to File GST for Meesho Sellers: Deducting Sales Returns Correctly

Meesho suppliers often experience high return rates. If you only report gross sales without deducting sales returns, you will overpay GST tax!

---

## Calculating Net Sales

\`\`\`
Net Taxable Sales = Gross Sales Taxable - Sales Return Taxable
\`\`\`

GSTPilot automatically merges Meesho Sales and Return files to calculate exact Net Sales for your monthly GSTR-1 filing.
`,
  },

  "tcs-reconciliation-guide-ecommerce": {
    slug: "tcs-reconciliation-guide-ecommerce",
    title: "E-Commerce TCS Reconciliation under Section 52 of GST Act",
    category: "TCS Compliance",
    excerpt:
      "How to reconcile Tax Collected at Source (TCS) reported by Amazon, Flipkart, and Meesho against your GSTR-1.",
    metaTitle: "E-Commerce TCS Reconciliation Guide | GSTPilot",
    metaDescription:
      "Learn how to compare state-wise GSTR-1 sales against GST Portal TCS exports to avoid tax notices.",
    publishedDate: "2025-07-25",
    readTime: "7 min read",
    author: "GSTPilot Compliance Team",
    content: `
# E-Commerce TCS Reconciliation under Section 52 of GST Act

Marketplaces deduct 1% TCS (0.5% CGST + 0.5% SGST or 1% IGST) under Section 52 and report state-wise net sales to the government.

---

## Why TCS Reconciliation is Critical

If your reported GSTR-1 sales differ significantly from the TCS figures reported by Amazon or Flipkart, the GST department may issue automated mismatch notices.

Use GSTPilot's **TCS Reconciliation Module** to verify state-wise totals before submitting GSTR-1.
`,
  },
};
