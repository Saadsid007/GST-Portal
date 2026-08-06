# GSTPilot Settings Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## Overview

The **Settings Module** manages workspace configuration, tax payer category defaults, automation toggles, user profile parameters, and theme preferences.

### Core Features

1. **Workspace Configuration**: Name, slug, default filing currency (`INR`), taxpayer category (`REGULAR`, `COMPOSITION`, `SEZ`), email notifications, and auto-validation flags.
2. **User Profile**: Full name, email (read-only), phone, job title, bio.
3. **UI Preferences**: Light / Dark / System default theme, default table pagination page size (`10`, `25`, `50`, `100`).

---

## Architecture & Component Structure

```
src/
├── app/(settings)/settings/
│   └── page.tsx                     # Settings route page (Server Component)
└── features/settings/
    ├── application/
    │   ├── settings.service.ts      # Permission-checked business logic
    │   └── index.ts
    ├── constants/
    │   ├── settings.constants.ts    # Action strings & page sizes
    │   └── index.ts
    ├── infrastructure/
    │   ├── settings.repository.ts   # Database CRUD for Workspace & Profile
    │   └── index.ts
    ├── presentation/
    │   ├── components/
    │   │   ├── profile-settings-form.tsx   # User profile form
    │   │   ├── settings-tabs.tsx          # Tabbed wrapper
    │   │   └── workspace-settings-form.tsx # Workspace config form
    │   └── index.ts
    ├── schemas/
    │   ├── settings.schemas.ts      # Zod validation schemas
    │   └── index.ts
    ├── server-actions/
    │   ├── settings.actions.ts      # Server Actions for settings updates
    │   └── index.ts
    ├── types/
    │   ├── settings.types.ts        # TypeScript domain models
    │   └── index.ts
    └── index.ts                     # Feature Public API
```

---

## Verification Results

- **TypeScript Compilation**: Passed (`pnpm typecheck`)
- **Unit Tests**: Passed (`pnpm test`)
- **Next.js Standalone Build**: Deployed at `/settings`

---

End of Document
