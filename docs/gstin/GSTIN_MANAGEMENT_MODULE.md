# GSTPilot GSTIN Management Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## 📌 Overview

The **GSTIN Management Module** provides comprehensive 15-character GST Registration handling in GSTPilot. Each **GSTIN** represents a registered tax identifier belonging to a **Client** business. Downstream **Party** and **Invoice** entities belong to a specific GSTIN, making GSTIN the parent registration entity for tax invoice generation and GST Return filings (GSTR-1, GSTR-3B).

---

## 🏛️ Architecture & Component Design

The module follows GSTPilot's **Feature-Based Modular Monolith** architecture:

```
src/
├── app/(dashboard)/gstin/
│   ├── page.tsx                     # GSTIN Directory (Table, Client Filter, Stats, Add Dialog)
│   ├── [id]/
│   │   ├── page.tsx                 # Server Component profile loader
│   │   └── gstin-details-container.tsx # Dynamic wrapper & revalidation
│   ├── loading.tsx                  # GstinListSkeleton fallback
│   └── error.tsx                    # Error boundary
└── features/gstin/
    ├── application/
    │   ├── gstin.service.ts         # Business logic orchestration, validation, audit logging
    │   └── index.ts
    ├── constants/
    │   ├── gstin.constants.ts       # Registration types (REGULAR, COMPOSITION, SEZ, ISD), GSTIN regex
    │   └── index.ts
    ├── domain/
    │   ├── gstin.policies.ts        # Pure functions: validateGstinFormat(), extractPanFromGstin(), deriveStateName()
    │   └── index.ts
    ├── infrastructure/
    │   ├── gstin.repository.ts      # Workspace & Client-isolated Prisma queries, soft-delete, status counters
    │   └── index.ts
    ├── presentation/
    │   ├── components/
    │   │   ├── gstin-activity-log.tsx  # Chronological audit timeline feed
    │   │   ├── gstin-delete-dialog.tsx# Deactivation/Restore confirmation modal
    │   │   ├── gstin-details-view.tsx # Full profile details view with tabs
    │   │   ├── gstin-form-dialog.tsx  # React Hook Form + Zod sheet form with auto-derived PAN & State
    │   │   ├── gstin-list-table.tsx   # TanStack Table component with Client filter, status filter, search
    │   │   ├── gstin-skeleton.tsx     # Skeleton loading components
    │   │   ├── gstin-stats.tsx        # KPI statistics metrics row
    │   │   └── gstin-status-badge.tsx # Accessible status badge
    │   └── index.ts
    ├── schemas/
    │   ├── gstin.schemas.ts         # Zod validation schemas
    │   └── index.ts
    ├── server-actions/
    │   ├── gstin.actions.ts         # Protected Server Actions (getGstinsAction, createGstinAction, etc.)
    │   └── index.ts
    ├── types/
    │   ├── gstin.types.ts           # GstinRecord, GstinWithRelations, filter types
    │   └── index.ts
    ├── validation/
    │   ├── gstin.validators.ts      # Server-side Zod validators
    │   └── index.ts
    └── index.ts                     # Feature Public API Boundary
```

---

## 🔒 Business Rules & Invariants

1. **Hierarchy**: Workspace (1) → Client (1) → GSTINs (Many). Every GSTIN belongs to a Client inside the workspace.
2. **15-Character Format**: Validated against `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`.
3. **Auto-Derivation**: Typing a 15-char GSTIN automatically derives State Code (`27`), State Name (`Maharashtra`), and PAN (`ABCDE1234F`).
4. **Global Uniqueness**: GSTIN numbers are unique across the platform. Duplicates are strictly rejected.
5. **Invoicing Guard**: Only `ACTIVE` GSTINs can issue or receive tax invoices. Inactive/deactivated GSTINs pause invoice generation while preserving all return filing records.
6. **Soft Delete**: Deactivating a GSTIN sets `deletedAt`, `deletedBy`, and transitions `status` to `INACTIVE`. GSTINs can be restored at any time.

---

## 🧪 Verification

- **TypeScript Compilation**: Passed with 0 errors (`pnpm typecheck`).
- **Unit Tests**: Passed with 100% pass rate across GSTIN format policies and Zod schemas (`pnpm test`).
- **Next.js Standalone Build**: Production build succeeded (`pnpm build`).

---

End of Document
