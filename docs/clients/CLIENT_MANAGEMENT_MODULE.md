# GSTPilot Client Management Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## 📌 Overview

The **Client Management Module** represents the root business entity model in GSTPilot following Workspace context. A **Client** represents a Business entity (Corporate, LLP, Proprietorship, Firm) operating inside a Workspace. Downstream GST entities (GSTINs, Parties, Invoices, Returns, Reports) belong to a Client.

---

## 🏛️ Architecture & Component Design

The module follows GSTPilot's **Feature-Based Modular Monolith** architecture:

```
src/
├── app/(dashboard)/clients/
│   ├── page.tsx                     # Client Directory page (Table, Search, Stats, Dialog)
│   ├── [id]/
│   │   ├── page.tsx                 # Server Component profile loader
│   │   └── client-details-container.tsx # Revalidation & dynamic wrapper
│   ├── loading.tsx                  # ClientListSkeleton fallback
│   └── error.tsx                    # Error boundary
└── features/clients/
    ├── application/
    │   ├── client.service.ts        # Business logic orchestration, PAN check, audit log
    │   └── index.ts
    ├── constants/
    │   ├── client.constants.ts      # Business types, Indian states, PAN regex, activity types
    │   └── index.ts
    ├── domain/
    │   ├── client.policies.ts       # Pure functions for PAN, pincode, client code, soft-delete
    │   └── index.ts
    ├── infrastructure/
    │   ├── client.repository.ts     # Workspace-isolated Prisma queries, soft-delete, PAN index
    │   └── index.ts
    ├── presentation/
    │   ├── components/
    │   │   ├── client-activity-log.tsx  # Chronological audit history feed
    │   │   ├── client-delete-dialog.tsx # Soft-delete & restore confirmation dialog
    │   │   ├── client-details-view.tsx  # Full client profile view with tabs
    │   │   ├── client-form-dialog.tsx   # React Hook Form + Zod sheet form
    │   │   ├── client-list-table.tsx    # TanStack Table component with search/filters/pagination
    │   │   ├── client-skeleton.tsx      # Skeleton loader components
    │   │   ├── client-stats.tsx         # KPI statistics row
    │   │   └── client-status-badge.tsx  # Accessible status badge
    │   └── index.ts
    ├── schemas/
    │   ├── client.schemas.ts        # Zod validation schemas
    │   └── index.ts
    ├── server-actions/
    │   ├── client.actions.ts        # Protected server actions (getClientsAction, etc.)
    │   └── index.ts
    ├── types/
    │   ├── client.types.ts          # ClientRecord, ClientWithCounts, filter types
    │   └── index.ts
    ├── validation/
    │   ├── client.validators.ts     # Server-side Zod validators
    │   └── index.ts
    └── index.ts                     # Public Feature API Boundary
```

---

## 🔒 Business Rules & Invariants

1. **Workspace Isolation**: Every database operation enforces `workspaceId`. Clients are never accessible across workspace boundaries.
2. **PAN Uniqueness**: PAN format must match `[A-Z]{5}[0-9]{4}[A-Z]{1}`. Duplicate PAN entries within the same workspace are rejected.
3. **Soft Delete**: Records are never hard-deleted from PostgreSQL. Deleting a client sets `deletedAt`, `deletedBy`, and transitions `status` to `INACTIVE`. GST transactions are fully preserved.
4. **Restoration**: Soft-deleted clients can be restored at any time by authorized users.
5. **Audit Logging**: Creation, update, soft-delete, and restoration events generate structured `ActivityLog` entries.

---

## 🧪 Verification

- **TypeScript Compilation**: Passed with 0 errors (`pnpm typecheck`).
- **Unit Tests**: Passed with 100% pass rate across domain policies and Zod schemas (`pnpm test`).
- **Next.js Standalone Build**: Production build succeeded (`pnpm build`).

---

End of Document
