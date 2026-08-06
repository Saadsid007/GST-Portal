# GSTPilot Party Master Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## 📌 Overview

The **Party Master Module** provides reusable Customer and Supplier Management in GSTPilot. Each **Party** record belongs to a parent **GSTIN** registration and acts as the counterparty for sales invoices, purchase invoices, e-invoicing, GSTR-1, and GSTR-3B filings. Invoices in GSTPilot reference a Party ID rather than storing customer details directly.

---

## 🏛️ Architecture & Component Design

The module adheres to GSTPilot's **Feature-Based Modular Monolith** architecture:

```
src/
├── app/(dashboard)/parties/
│   ├── page.tsx                     # Party Directory (Table, GSTIN Filter, Type Filter, Stats, Add Dialog)
│   ├── [id]/
│   │   ├── page.tsx                 # Server Component profile loader
│   │   └── party-details-container.tsx # Dynamic wrapper & revalidation
│   ├── loading.tsx                  # PartyListSkeleton fallback
│   └── error.tsx                    # Error boundary
└── features/party/
    ├── application/
    │   ├── party.service.ts         # Business logic orchestration, validation, audit logging
    │   └── index.ts
    ├── constants/
    │   ├── party.constants.ts       # Party types (CUSTOMER, SUPPLIER, BOTH), activity types
    │   └── index.ts
    ├── domain/
    │   ├── party.policies.ts        # Pure domain functions: validatePartyGstin(), isB2bParty(), isB2cParty()
    │   └── index.ts
    ├── infrastructure/
    │   ├── party.repository.ts      # Workspace & GSTIN-isolated Prisma queries, duplicate checks, status counters
    │   └── index.ts
    ├── presentation/
    │   ├── components/
    │   │   ├── party-activity-log.tsx  # Chronological audit timeline feed
    │   │   ├── party-delete-dialog.tsx# Deactivation/Restore confirmation modal
    │   │   ├── party-details-view.tsx # Full profile view with tabs (Overview, Invoices, Ledger, Activity)
    │   │   ├── party-form-dialog.tsx  # React Hook Form + Zod sheet form (B2B/B2C toggle, auto-PAN)
    │   │   ├── party-list-table.tsx   # TanStack Table with search, GSTIN filter, party type filter, pagination
    │   │   ├── party-skeleton.tsx     # Skeleton loading components
    │   │   ├── party-stats.tsx        # KPI metrics row (Total Parties, Customers, Suppliers, Dual Role)
    │   │   └── party-status-badge.tsx # Accessible status badge & type badges
    │   └── index.ts
    ├── schemas/
    │   ├── party.schemas.ts         # Zod validation schemas
    │   └── index.ts
    ├── server-actions/
    │   ├── party.actions.ts         # Protected Server Actions (getPartiesAction, createPartyAction, etc.)
    │   └── index.ts
    ├── types/
    │   ├── party.types.ts           # PartyRecord, PartyWithRelations, PartyOption, filter types
    │   └── index.ts
    ├── validation/
    │   ├── party.validators.ts      # Server-side Zod validators
    │   └── index.ts
    └── index.ts                     # Feature Public API Boundary
```

---

## 🔒 Business Rules & Invariants

1. **Hierarchy**: Workspace (1) → Client (1) → GSTIN (1) → Party (Many) → Invoice (Many).
2. **Classifications**: `CUSTOMER` (sales invoices), `SUPPLIER` (purchase invoices), `BOTH` (dual-role entity).
3. **B2B vs. B2C Handling**:
   - For B2B parties: 15-character GSTIN (`partyGstin`) is provided and validated. PAN, State Code, and State Name are auto-extracted.
   - For B2C parties: GSTIN is optional (`null`). State Code and Pincode are required for place-of-supply tax computation.
4. **Duplicate Party Prevention**: Checks for matching Party Name or GSTIN within the same parent GSTIN registration.
5. **Invoice Consumption**: The Party module exports lightweight `PartyOption` objects (`getPartyOptionsForInvoiceAction`) for downstream Invoice creation.
6. **Soft Delete**: Deactivating a party sets `deletedAt`, `deletedBy`, and transitions `status` to `INACTIVE`. Historical invoice records are preserved intact.

---

## 🧪 Verification

- **TypeScript Compilation**: Passed with 0 errors (`pnpm typecheck`).
- **Unit Tests**: Passed with 100% pass rate across party policies and Zod schemas (`pnpm test`).
- **Next.js Standalone Build**: Production build succeeded (`pnpm build`).

---

End of Document
