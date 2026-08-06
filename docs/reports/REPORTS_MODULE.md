# GSTPilot Reports Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## 📌 Overview

The **Reports Module** is the final presentation, analytics, and data export layer for GSTPilot.

### Guiding Principles

1. **Read-Only**: Reports consume processed, validated data. They **NEVER** create, edit, or delete business data.
2. **Permission-Guaranteed**: Every report query and export action enforces workspace isolation and `report.read` permissions.
3. **Multi-Format Export**: All 8 report types support one-click Excel (`.xlsx`) and CSV (`.csv`) file downloads.

---

## 🏛️ Architecture & Component Structure

```
src/
├── app/(dashboard)/reports/
│   ├── page.tsx               # Main Reports Dashboard (8 report cards)
│   ├── sales/page.tsx         # Sales Summary Report
│   ├── invoices/page.tsx      # Invoice Register Report
│   ├── parties/page.tsx       # Party Ledger Summary Report
│   ├── gst-summary/page.tsx   # GST Liability Summary Report
│   ├── hsn/page.tsx           # HSN / SAC Summary Report
│   ├── uploads/page.tsx       # Upload Pipeline Audit Report
│   ├── validation/page.tsx    # Validation Error Insights Report
│   └── activity/page.tsx      # Security Activity Audit Log Report
└── features/reports/
    ├── application/
    │   ├── export.application.ts # Excel & CSV export generator
    │   ├── report.service.ts     # Permission-guaranteed data pipeline
    │   └── index.ts
    ├── constants/
    │   ├── report.constants.ts   # Report metadata, column defs, audit strings
    │   └── index.ts
    ├── domain/
    │   ├── report.aggregators.ts # Pure data aggregation functions
    │   └── index.ts
    ├── infrastructure/
    │   ├── export.service.ts     # xlsx library integration & CSV serializer
    │   ├── report.repository.ts # Read-only database queries
    │   └── index.ts
    ├── presentation/
    │   ├── components/
    │   │   ├── gst-summary-chart.tsx   # Recharts pie chart
    │   │   ├── report-dashboard.tsx    # 8-card report hub
    │   │   ├── report-data-table.tsx   # Reusable TanStack Table
    │   │   ├── report-export-button.tsx# Excel & CSV export dropdown
    │   │   ├── report-filters.tsx      # Shared filter bar
    │   │   ├── report-skeleton.tsx     # Loading fallback
    │   │   └── sales-summary-chart.tsx # Recharts monthly sales bar chart
    │   └── index.ts
    ├── schemas/
    │   ├── report.schemas.ts     # Zod filter, export, and pagination schemas
    │   └── index.ts
    ├── server-actions/
    │   ├── report.actions.ts     # Server Actions for reports & exports
    │   └── index.ts
    ├── types/
    │   ├── report.types.ts       # Domain types for all 8 report rows
    │   └── index.ts
    └── index.ts                  # Feature Public API
```

---

## 📊 Summary of 8 Report Categories

| Report                        | Path                   | Key Metrics & Data                                                     | Exports    |
| ----------------------------- | ---------------------- | ---------------------------------------------------------------------- | ---------- |
| **Sales Summary**             | `/reports/sales`       | Monthly sales, taxable value, CGST, SGST, IGST totals + Bar Chart      | Excel, CSV |
| **Invoice Register**          | `/reports/invoices`    | Detailed list of outward/inward invoices, GST category, status         | Excel, CSV |
| **Party Ledger Summary**      | `/reports/parties`     | Per-customer/supplier transaction totals, GSTIN, taxable amount        | Excel, CSV |
| **GST Liability Summary**     | `/reports/gst-summary` | Category split (B2B, B2CL, B2CS) and tax rate distribution + Pie Chart | Excel, CSV |
| **HSN / SAC Summary**         | `/reports/hsn`         | HSN/SAC code summary, UQC unit, quantity, tax breakdown                | Excel, CSV |
| **Upload Pipeline Audit**     | `/reports/uploads`     | Batch file audit trail, file size, parsed rows, error rows             | Excel, CSV |
| **Validation Error Insights** | `/reports/validation`  | Rule failure frequency, severity (Error/Warning), affected files       | Excel, CSV |
| **Activity Audit Log**        | `/reports/activity`    | Security audit log of user actions, timestamps, entity IDs             | Excel, CSV |

---

## 🧪 Verification Results

- **TypeScript Compilation**: Passed (`pnpm typecheck`)
- **Unit Tests**: Passed (`pnpm test`)
- **Next.js Standalone Build**: Passed (`pnpm build`)

---

End of Document
