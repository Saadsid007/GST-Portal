# GSTPilot Admin Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## Overview

The **Admin Module** provides workspace-wide health monitoring, system metric tracking (active users, managed clients, processed invoices, batch uploads), and user role assignment oversight.

---

## Component Architecture

```
src/
├── app/(dashboard)/admin/page.tsx # Admin route (Server Component)
└── features/admin/
    ├── application/admin.service.ts
    ├── constants/admin.constants.ts
    ├── infrastructure/admin.repository.ts
    ├── presentation/components/
    │   ├── admin-stats-cards.tsx
    │   ├── admin-workbench.tsx
    │   └── user-roles-table.tsx
    ├── schemas/admin.schemas.ts
    ├── server-actions/admin.actions.ts
    ├── types/admin.types.ts
    └── index.ts
```

---

End of Document
