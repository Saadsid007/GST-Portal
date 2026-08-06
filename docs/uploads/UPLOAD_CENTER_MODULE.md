# GSTPilot Upload Center Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## 📌 Overview

The **Upload Center Module** is the core entry point for importing raw invoice data files (Excel `.xlsx` / `.xls` and CSV `.csv`) into GSTPilot.

### Pipeline Position

```
Workspace → Client → GSTIN → Upload → [Validation Engine] → Invoice Creation
```

> **Crucial Rule**: Uploads **NEVER** directly create invoices. Every upload parses data into staging records (`ParsedRow[]`) and updates status to `VALIDATED`. Invoices are created only after the Validation Engine verifies compliance.

---

## 🏛️ Architecture & Component Structure

```
src/
├── app/(dashboard)/uploads/
│   ├── page.tsx                      # Upload Dashboard (Stats + Dropzone + History Table)
│   ├── [id]/
│   │   ├── page.tsx                  # Upload Details Profile
│   │   └── upload-details-container.tsx # Dynamic client container & revalidation
│   ├── loading.tsx                   # UploadListSkeleton fallback
│   └── error.tsx                     # Error boundary
└── features/uploads/
    ├── application/
    │   ├── upload.service.ts         # Full upload pipeline, storage integration, parser invocation
    │   └── index.ts
    ├── constants/
    │   ├── upload.constants.ts       # Allowed types, max 10MB limit, audit action constants
    │   └── index.ts
    ├── domain/
    │   ├── file-parser.ts            # Pure Excel (SheetJS) and CSV row-level parsers
    │   ├── upload.policies.ts       # Extension/MIME check, SHA-256 checksum duplicate detection
    │   └── index.ts
    ├── infrastructure/
    │   ├── storage.service.ts       # Storage abstraction (LocalStorageService dev / R2StorageService prod)
    │   ├── upload.repository.ts     # Workspace-isolated Prisma queries, stats aggregations
    │   └── index.ts
    ├── presentation/
    │   ├── components/
    │   │   ├── upload-activity-log.tsx  # Audit timeline feed
    │   │   ├── upload-details-view.tsx # Detailed view with staging rows preview
    │   │   ├── upload-dropzone.tsx    # Drag & drop file browser with upload progress bar
    │   │   ├── upload-list-table.tsx   # TanStack Table with search, status filter, retry/cancel
    │   │   ├── upload-skeleton.tsx     # Skeleton loading states
    │   │   ├── upload-stats.tsx        # KPI summary metric cards
    │   │   └── upload-status-badge.tsx # Badges for PENDING, PROCESSING, VALIDATED, etc.
    │   └── index.ts
    ├── schemas/
    │   ├── upload.schemas.ts        # Zod validation schemas
    │   └── index.ts
    ├── server-actions/
    │   ├── upload.actions.ts        # Server Actions (uploadFileAction, retryUploadAction, etc.)
    │   └── index.ts
    ├── types/
    │   ├── upload.types.ts          # UploadRecord, ParsedRow, ParseSummary, UploadStats
    │   └── index.ts
    ├── validation/
    │   ├── upload.validators.ts     # Server-side validation helpers
    │   └── index.ts
    └── index.ts                     # Feature Public API Boundary
```

---

## 🔒 Security & Duplicate Rules

1. **Double Extension & MIME Check**: Validates both filename extension (`.xlsx`, `.xls`, `.csv`) and browser-supplied MIME type.
2. **SHA-256 Checksum Duplicate Detection**: Computes a SHA-256 hash of the uploaded file contents before processing. If an identical file exists in the workspace, sets `checksumDuplicate = true` while preserving audit history.
3. **Workspace Isolation**: All database queries and storage keys are scoped under `workspaceId`.

---

## 🧪 Verification Results

- **TypeScript Compilation**: Passed with 0 errors (`pnpm typecheck`).
- **Unit Tests**: Passed with 100% pass rate (`pnpm test`).
- **Next.js Production Build**: Succeeded (`pnpm build`).

---

End of Document
