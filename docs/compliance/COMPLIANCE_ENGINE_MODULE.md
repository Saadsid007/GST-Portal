# GSTPilot Compliance Engine Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## Overview

The **Compliance Engine Module** is the GST business rule engine of GSTPilot. It is the **only** module responsible for GST classification, tax table aggregation, GSTR-1 return structure generation, and official GSTN JSON file production.

### Pipeline Position

```
Invoice (VALIDATED)
    ↓
Compliance Engine (Classification + Aggregation)
    ↓
Gstr1Structure (B2B, B2CL, B2CS, Export, CDNR, HSN, Docs)
    ↓
ComplianceSummary (Tax Totals by Section)
    ↓
GSTR-1 JSON (GSTN Offline Tool Format)
    ↓
GstReturn DB Record → Reports
```

---

## Architecture & Component Structure

```
src/
├── app/(dashboard)/reports/gstr1/
│   ├── page.tsx         # GSTR-1 Workbench route (Server Component)
│   ├── loading.tsx      # ComplianceSkeleton fallback
│   └── error.tsx        # Error boundary
└── features/compliance/
    ├── application/
    │   ├── compliance.service.ts  # Service orchestrating GSTR-1 pipeline
    │   └── index.ts
    ├── constants/
    │   ├── compliance.constants.ts # B2CL threshold, UQC, GSTR1 schema version
    │   └── index.ts
    ├── domain/
    │   ├── gstr1-classifier.ts    # Pure invoice → table classification
    │   ├── gstr1-builder.ts       # Pure section aggregators & tax summaries
    │   ├── gstr1-json-generator.ts # Government JSON serializer
    │   └── index.ts
    ├── infrastructure/
    │   ├── compliance.repository.ts # Prisma repo for GstReturn + Invoice queries
    │   └── index.ts
    ├── presentation/
    │   ├── components/
    │   │   ├── compliance-skeleton.tsx  # Loading skeleton
    │   │   ├── compliance-workbench.tsx # Interactive GSTR-1 generation UI
    │   │   ├── gstr1-json-viewer.tsx    # JSON viewer + Download button
    │   │   ├── gstr1-summary-cards.tsx  # Executive KPI cards
    │   │   └── gstr1-table-view.tsx     # Tabbed Table 4/5/7/12/13 inspector
    │   └── index.ts
    ├── schemas/
    │   ├── compliance.schemas.ts  # Zod schemas for return generation and filters
    │   └── index.ts
    ├── server-actions/
    │   ├── compliance.actions.ts  # Protected Server Actions
    │   └── index.ts
    ├── types/
    │   ├── compliance.types.ts    # Full GSTR-1 type system
    │   └── index.ts
    └── index.ts                   # Feature Public API
```

---

## GSTR-1 Table Classification Rules

| Table        | Category | Classification Rule                                                                  |
| ------------ | -------- | ------------------------------------------------------------------------------------ |
| **Table 4**  | B2B      | `partyGstin` present (Registered receiver). Includes SEZ.                            |
| **Table 5**  | B2CL     | `partyGstin` absent + Interstate (`POS ≠ supplierState`) + `totalAmount > ₹2,50,000` |
| **Table 7**  | B2CS     | `partyGstin` absent + Intra-state OR Interstate ≤ ₹2.5L (grouped by POS & Rate)      |
| **Table 6A** | EXPORT   | `invoiceType === EXPORT`                                                             |
| **Table 9B** | CDNR     | `invoiceType === CREDIT_NOTE / DEBIT_NOTE` with `partyGstin` present                 |
| **Table 9B** | CDNUR    | `invoiceType === CREDIT_NOTE / DEBIT_NOTE` without `partyGstin`                      |
| **Table 12** | HSN      | HSN/SAC summary of all outward supplies                                              |
| **Table 13** | DOCS     | Document serial number summary                                                       |

> **B2CL Threshold**: `B2CL_THRESHOLD_AMOUNT = 250000` (₹2.5 Lakh).

---

End of Document
