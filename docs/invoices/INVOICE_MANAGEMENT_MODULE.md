# GSTPilot Invoice Management Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## 📌 Overview

The **Invoice Management Module** is the core transaction engine of GSTPilot. Every GST return generation (GSTR-1, GSTR-3B), reconciliation, report, and compliance validation depends on accurate invoice records.

It supports all Indian GST invoice classifications:

- **B2B**: Outward taxable supplies to GST-registered persons.
- **B2CL**: Inter-state supplies to unregistered consumers with invoice value > ₹2,50,000.
- **B2CS**: Intra-state supplies or inter-state supplies ≤ ₹2,50,000 to unregistered consumers.
- **Export**: Supplies exported outside India with/without payment of tax.
- **SEZ**: Supplies to Special Economic Zone units or developers.
- **Credit Note / Debit Note**: Adjustment documents.

---

## 🏛️ Architecture & Component Design

The module adheres to GSTPilot's **Feature-Based Modular Monolith** architecture:

```
src/
├── app/(dashboard)/invoices/
│   ├── page.tsx                     # Invoice Register (Table, GSTIN Filter, Category Filter, Stats)
│   ├── new/page.tsx                 # Create Invoice Page (InvoiceFormWizard)
│   ├── [id]/
│   │   ├── page.tsx                 # Server Component invoice profile loader
│   │   ├── invoice-details-container.tsx # Dynamic wrapper & revalidation
│   │   └── edit/page.tsx            # Edit Invoice Page
│   ├── loading.tsx                  # InvoiceListSkeleton fallback
│   └── error.tsx                    # Error boundary
└── features/invoices/
    ├── application/
    │   ├── invoice.service.ts       # Service orchestration, permission guards, duplicate check
    │   └── index.ts
    ├── constants/
    │   ├── invoice.constants.ts     # Document types, GST categories, common GST rates, UOMs
    │   └── index.ts
    ├── domain/
    │   ├── tax-calculation.engine.ts# Pure GST tax engine (Intra-state CGST+SGST vs Inter-state IGST)
    │   ├── invoice.policies.ts      # Pure domain policies: Rule 46 number validation, HSN format, auto-category
    │   └── index.ts
    ├── infrastructure/
    │   ├── invoice.repository.ts    # Workspace & GSTIN-isolated Prisma transaction queries, stats counters
    │   └── index.ts
    ├── presentation/
    │   ├── components/
    │   │   ├── invoice-activity-log.tsx  # Chronological audit timeline feed
    │   │   ├── invoice-delete-dialog.tsx# Deactivation/Restore confirmation modal
    │   │   ├── invoice-details-view.tsx # Full profile view with line items table & tax summary
    │   │   ├── invoice-form-wizard.tsx  # Dynamic line item editor with real-time tax calculation output
    │   │   ├── invoice-list-table.tsx   # TanStack Table with search, category filter, duplicate action
    │   │   ├── invoice-skeleton.tsx     # Skeleton loading fallbacks
    │   │   ├── invoice-stats.tsx        # KPI metrics summary cards
    │   │   └── invoice-status-badge.tsx # Accessible status, type, and GST category badges
    │   └── index.ts
    ├── schemas/
    │   ├── invoice.schemas.ts       # Zod validation schemas
    │   └── index.ts
    ├── server-actions/
    │   ├── invoice.actions.ts       # Protected Server Actions (createInvoiceAction, duplicateInvoiceAction, etc.)
    │   └── index.ts
    ├── types/
    │   ├── invoice.types.ts         # InvoiceRecord, InvoiceItemRecord, InvoiceWithRelations, inputs, tax calculation types
    │   └── index.ts
    ├── validation/
    │   ├── invoice.validators.ts    # Server-side Zod validators
    │   └── index.ts
    └── index.ts                     # Feature Public API Boundary
```

---

## 🧮 Tax Calculation Engine Rules

1. **Supply Type Determination**:
   - `INTRA_STATE` (CGST + SGST) if Supplier State Code == Place of Supply Code (POS).
   - `INTER_STATE` (IGST) if Supplier State Code != Place of Supply Code (POS) OR category is EXPORT or SEZ.
2. **Item-Level Tax Calculation**:
   - `taxableAmount` = `quantity` * `rate`
   - If Intra-State: `cgstRate` = `gstRate` / 2, `sgstRate` = `gstRate` / 2, `igstRate` = 0.
   - If Inter-State: `cgstRate` = 0, `sgstRate` = 0, `igstRate` = `gstRate`.
   - `cgstAmount` = `taxableAmount` * (`cgstRate` / 100)
   - `sgstAmount` = `taxableAmount` * (`sgstRate` / 100)
   - `igstAmount` = `taxableAmount` * (`igstRate` / 100)
   - `cessAmount` = `taxableAmount` * (`cessRate` / 100)
   - `totalAmount` = `taxableAmount` + `cgstAmount` + `sgstAmount` + `igstAmount` + `cessAmount`
3. **Header Totals Aggregation**:
   - Sum of line item taxable amounts, CGST, SGST, IGST, CESS, and total amounts.

---

## 🧪 Verification

- **TypeScript Compilation**: Passed with 0 errors (`pnpm typecheck`).
- **Unit Tests**: Passed with 100% pass rate across tax engine, policies, and schemas (`pnpm test`).
- **Next.js Standalone Build**: Production build succeeded (`pnpm build`).

---

End of Document
