# GSTPilot Billing Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## Overview

The **Billing Module** handles workspace subscription plans, usage quotas (Client profiles count, GSTIN registrations count, AI Copilot credits), and plan upgrades.

---

## Tiers & Limits

| Plan Key     | Name            | Monthly (₹) | Clients | GSTINs | AI Credits |
| ------------ | --------------- | ----------- | ------- | ------ | ---------- |
| `FREE_TRIAL` | Free Trial      | ₹0          | 5       | 1      | 100        |
| `STARTER`    | CA Firm Starter | ₹1,499      | 25      | 10     | 1,000      |
| `PRO`        | Pro Firm        | ₹3,999      | 100     | 50     | 5,000      |
| `ENTERPRISE` | Enterprise      | ₹9,999      | 1,000   | 500    | 50,000     |

---

## Component Architecture

```
src/
├── app/(dashboard)/billing/page.tsx # Billing route (Server Component)
└── features/billing/
    ├── application/billing.service.ts
    ├── constants/billing.constants.ts
    ├── infrastructure/billing.repository.ts
    ├── presentation/components/
    │   ├── billing-plans-grid.tsx
    │   ├── billing-workbench.tsx
    │   └── usage-meters.tsx
    ├── schemas/billing.schemas.ts
    ├── server-actions/billing.actions.ts
    ├── types/billing.types.ts
    └── index.ts
```

---

End of Document
