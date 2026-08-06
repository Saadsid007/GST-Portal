# GSTPilot Folder Structure

Version: 1.0.0

Status: Active

---

# Purpose

This document defines the complete folder structure of GSTPilot.

Every developer and AI coding assistant MUST follow this document.

Folders must never be created randomly.

Every folder has one responsibility.

---

# Root Structure

GSTPilot/

├── docs/
├── prompts/
├── references/
├── templates/
├── decisions/
├── prisma/
├── public/
├── src/
├── package.json
├── next.config.ts
├── tsconfig.json
├── components.json
├── eslint.config.mjs
├── middleware.ts
└── README.md

---

# docs/

Contains project documentation.

Never store source code.

Structure

docs/

00_PROJECT_CONSTITUTION.md

01_SYSTEM_OVERVIEW.md

01.5_PRODUCT_TERMINOLOGY.md

02_PROJECT_ARCHITECTURE.md

03_FOLDER_STRUCTURE.md

...

---

# prompts/

Contains Claude prompts.

Example

prompts/

setup.md

authentication.md

dashboard.md

clients.md

invoice.md

gst.md

---

# templates/

Reusable templates.

Examples

CRUD.md

Feature.md

API.md

Migration.md

Release.md

---

# references/

Contains reference materials.

Examples

GST JSON

Sample Excel

GST Rules

API Samples

HSN List

State Codes

GST Notifications

---

# decisions/

Architecture Decision Records.

Examples

ADR-001.md

ADR-002.md

ADR-003.md

Every major architecture change must have an ADR.

---

# public/

Only static assets.

Examples

Logo

Images

Fonts

Icons

Never place business files here.

---

# prisma/

schema.prisma

migrations/

seed.ts

Only Prisma-related files.

---

# src/

Contains all application code.

Structure

src/

app/

features/

shared/

lib/

config/

hooks/

types/

middleware/

styles/

services/

---

# app/

Responsible only for routing.

Never place business logic here.

Contains

layout.tsx

page.tsx

error.tsx

loading.tsx

not-found.tsx

api/

(auth)/

(dashboard)/

(settings)/

---

# app/api/

Backend API.

Each feature owns its own API.

Example

api/

auth/

clients/

gstin/

invoice/

reports/

ai/

billing/

---

# features/

Business logic lives here.

Every feature owns itself.

Structure

features/

auth/

dashboard/

clients/

gstin/

party/

invoice/

upload/

validation/

compliance/

reports/

ai/

billing/

settings/

admin/

---

# Feature Template

Every feature MUST follow the same structure.

feature/

application/

domain/

infrastructure/

presentation/

validation/

constants/

types/

schemas/

api/

index.ts

---

# application/

Contains use cases.

Examples

Create Client

Update Client

Delete Client

Generate JSON

---

# domain/

Business rules.

Contains

Entities

Interfaces

Types

Policies

No UI.

No database.

---

# infrastructure/

Implementation details.

Examples

Prisma

Repositories

Storage

Third-party APIs

---

# presentation/

Everything user-facing.

Contains

Components

Hooks

Pages

Dialogs

Tables

Forms

---

# validation/

Contains

Zod Schemas

Business Validation

Custom Validators

---

# shared/

Reusable code.

Structure

shared/

components/

ui/

forms/

tables/

layout/

icons/

charts/

---

Never place feature-specific code here.

---

# lib/

Core libraries.

Examples

prisma.ts

auth.ts

logger.ts

cache.ts

env.ts

permissions.ts

---

# config/

Configuration only.

theme.ts

navigation.ts

permissions.ts

constants.ts

app.ts

---

# hooks/

Global reusable hooks.

Examples

useDebounce

useMediaQuery

useLocalStorage

Feature hooks belong inside features.

---

# services/

Global services.

Examples

AI

Storage

Notification

Payment

Analytics

Logging

---

# styles/

Global styles.

Contains

globals.css

themes.css

variables.css

---

# types/

Shared TypeScript types.

Feature-specific types remain inside features.

---

# Naming Rules

Folders

kebab-case

Files

kebab-case

Components

PascalCase

Hooks

camelCase

Constants

UPPER_CASE

Enums

PascalCase

Interfaces

PascalCase

---

# Import Rules

Always use aliases.

Correct

import { ClientTable } from "@/features/clients";

Wrong

import ClientTable from "../../../../components/client-table";

---

# Feature Isolation

Feature A

Cannot access

Feature B internal files.

Use

index.ts

as the public interface.

---

# Shared Rule

If code is used by

2+ features

move to

shared/

Otherwise

keep it inside the feature.

---

# Forbidden

Never create folders like

helpers/

misc/

temp/

test2/

new/

old/

utils2/

These create technical debt.

---

# AI Coding Rules

Before creating any folder

Verify

Does it already exist?

Can an existing module be reused?

Is it feature-specific?

Should it be shared?

Never invent folder names.

Always follow this structure.

---

End of Document
