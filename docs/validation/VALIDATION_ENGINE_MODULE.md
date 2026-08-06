# GSTPilot Validation Engine Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## 📌 Overview

The **Validation Engine Module** is a rule-based data compliance validation system for GST data.

### Pipeline Position

```
Upload (ParsedRow[]) → Validation Engine → ValidationResult[]
                                        → Error Summary
                                        → Row-wise Report UI
                                        → [Corrections] → Invoice Creation
```

> **Core Rule**: Validation **NEVER** modifies data. It only inspects and reports findings with severity classifications (`ERROR`, `WARNING`, `INFO`).

---

## 🏛️ Architecture & Component Structure

```
src/
├── app/(dashboard)/uploads/[id]/
│   └── validation/
│       ├── page.tsx                    # Detailed validation run report page
│       ├── loading.tsx                 # ValidationSkeleton fallback
│       └── error.tsx                   # Error boundary
└── features/validation/
    ├── application/
    │   ├── validation.service.ts       # Service orchestrating validation runs & DB updates
    │   └── index.ts
    ├── constants/
    │   ├── validation.constants.ts     # Rule code descriptions, severity colors, state codes
    │   └── index.ts
    ├── domain/
    │   ├── rules/
    │   │   ├── mandatory-fields.rule.ts # Required field check
    │   │   ├── gstin-format.rule.ts     # 15-char GSTIN regex + state mismatch
    │   │   ├── invoice-number.rule.ts   # Format, length & special chars
    │   │   ├── invoice-date.rule.ts     # Parseability, future date, 6-month stale check
    │   │   ├── tax-amount.rule.ts       # (taxable × rate / 100) vs reported tax
    │   │   ├── hsn.rule.ts              # 4, 6, 8-digit HSN code checks
    │   │   ├── place-of-supply.rule.ts  # 2-digit state code validation
    │   │   └── duplicate-invoice.rule.ts # Batch & DB duplicate detection
    │   ├── validation.engine.ts        # Pure central rule runner (validateRow, validateRows)
    │   ├── validation.policies.ts      # Pure predicates (canImportWithResults, passRate)
    │   └── index.ts
    ├── infrastructure/
    │   ├── validation.repository.ts    # Prisma repository for ValidationRun records
    │   └── index.ts
    ├── presentation/
    │   ├── components/
    │   │   ├── validation-severity-badge.tsx  # Red / Amber / Blue severity badges
    │   │   ├── validation-summary-card.tsx    # KPI summary card with progress bar & callout banner
    │   │   ├── validation-findings-table.tsx  # TanStack Table of all findings with search & filter
    │   │   ├── validation-row-accordion.tsx   # Row-by-row drilldown accordion
    │   │   ├── validation-run-trigger.tsx     # CTA button to execute rule engine
    │   │   └── validation-skeleton.tsx        # Skeleton loading fallback
    │   └── index.ts
    ├── schemas/
    │   ├── validation.schemas.ts       # Zod schemas for runValidation and filters
    │   └── index.ts
    ├── server-actions/
    │   ├── validation.actions.ts       # Protected Server Actions (runValidationAction, etc.)
    │   └── index.ts
    ├── types/
    │   ├── validation.types.ts         # ValidationFinding, ValidationSummary, ValidationRule
    │   └── index.ts
    └── index.ts                        # Feature Public API Boundary
```

---

## 🔒 Severity Rules & Business Decisions

| Severity  | Behavior                                                        | Example                                                                       |
| --------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ERROR`   | **Blocks import** (`canImport = false`). Must be fixed.         | Missing invoice number, tax math mismatch > ₹1, malformed GSTIN               |
| `WARNING` | **Allows import** (`canImport = true`). Highlighted for review. | Future invoice date, B2B missing GSTIN (may be B2C), Place of Supply mismatch |
| `INFO`    | **Advisory only**. No action required.                          | Invoice date > 6 months old (late entry)                                      |

---

## 🧪 Verification Results

- **TypeScript Compilation**: Passed with 0 errors (`pnpm typecheck`).
- **Unit Tests**: Passed with 100% pass rate (`pnpm test`).
- **Next.js Production Build**: Succeeded (`pnpm build`).

---

End of Document
