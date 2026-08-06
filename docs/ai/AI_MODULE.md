# GSTPilot AI Copilot Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## Overview

The **AI Copilot Module** provides real-time GST compliance assistance, GSTR-1 classification guidance, Place of Supply tax liability resolution, HSN/SAC lookups, and validation error explanations.

---

## Component Architecture

```
src/
├── app/(dashboard)/ai/page.tsx # AI Copilot route (Server Component)
└── features/ai/
    ├── application/ai.service.ts
    ├── constants/ai.constants.ts
    ├── domain/ai-assistant-engine.ts
    ├── infrastructure/ai.repository.ts
    ├── presentation/components/
    │   ├── ai-chat-view.tsx
    │   └── ai-suggestion-cards.tsx
    ├── schemas/ai.schemas.ts
    ├── server-actions/ai.actions.ts
    ├── types/ai.types.ts
    └── index.ts
```

---

End of Document
