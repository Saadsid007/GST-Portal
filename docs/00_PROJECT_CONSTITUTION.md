# GSTPilot Project Constitution

Version: 1.0.0
Status: Active
Last Updated: July 2026

---

# Purpose

This document is the single source of truth for GSTPilot.

Every developer, AI coding assistant, contributor, and future team member MUST follow this document before writing, modifying, or reviewing any code.

This document defines the architecture, philosophy, standards, and long-term vision of the project.

If any implementation conflicts with this document, this document takes precedence.

---

# Vision

GSTPilot is a modern AI-powered GST Compliance Platform built for:

- Individual Businesses
- Chartered Accountants
- Small & Medium Businesses

The goal is NOT to become another GST utility.

The goal is to become the easiest GST platform to use.

Every workflow should reduce manual work.

Every feature should save time.

Every screen should feel premium.

---

# Long Term Vision

Version 1

✔ GSTR1
✔ Clients
✔ GSTIN
✔ Invoice
✔ Reports

Version 2

✔ AI
✔ OCR
✔ Reconciliation
✔ Team Members
✔ Analytics

Version 3

✔ Enterprise
✔ White Label
✔ ERP Integrations
✔ API Platform

---

# Core Philosophy

GSTPilot follows these principles.

## Rule 1

Simple is always better than complex.

Never introduce complexity unless it solves a real problem.

---

## Rule 2

Every feature must be modular.

Nothing should depend tightly on another module.

Every module should be removable.

---

## Rule 3

Code for future expansion.

Never code only for today's requirement.

Design in a way that tomorrow's features can be added without rewriting the project.

---

## Rule 4

Reusability over duplication.

Never duplicate:

- Components
- Hooks
- Services
- Schemas
- Utilities

---

## Rule 5

Readability > Cleverness.

Readable code is always preferred.

---

## Rule 6

Never hardcode.

Everything configurable must live inside configuration.

---

## Rule 7

Every feature should have one responsibility.

Authentication should not know GST logic.

GST should not know Billing.

Billing should not know AI.

---

# Architecture

GSTPilot follows

Feature Based Modular Monolith Architecture

NOT

Microservices

Reason:

- Easier Development
- Easier Deployment
- Easier Maintenance
- Easier Testing

Future modules can later become independent services.

---

# Tech Stack

Frontend

- Next.js (App Router)
- TypeScript
- TailwindCSS
- shadcn/ui
- Radix UI
- Framer Motion

Backend

- Next.js Route Handlers

Database

- PostgreSQL

ORM

- Prisma

State Management

- Zustand

Forms

- React Hook Form
- Zod

Tables

- TanStack Table

Charts

- Recharts

Icons

- Lucide

Authentication

- Better Auth (or Auth.js if project direction changes)

AI

- Provider abstraction layer (Gemini/OpenAI/Claude)

Storage

- Cloudflare R2 or AWS S3

Payments

- Razorpay

---

# Folder Strategy

The application MUST use Feature Based Architecture.

Every feature owns:

- UI
- Logic
- API
- Validation
- Types
- Components

Shared logic should only exist when truly reused.

---

# Naming Rules

Variables

camelCase

Functions

camelCase

Components

PascalCase

Folders

kebab-case

Interfaces

PascalCase

Enums

PascalCase

Constants

UPPER_CASE

Files

kebab-case

---

# UI Philosophy

GSTPilot UI should feel like:

- Stripe
- Vercel
- Linear
- Notion

Characteristics

- Clean
- Spacious
- Modern
- Fast
- Accessible

Avoid:

- Bright gradients everywhere
- Heavy shadows
- Cluttered layouts
- Old Bootstrap-style interfaces

---

# Design Rules

Every page must include:

- Empty State
- Loading State
- Error State
- Success State

Every form must support:

- Validation
- Reset
- Keyboard navigation

Every table must support:

- Search
- Sort
- Pagination
- Filters

---

# API Philosophy

REST First

Consistent responses.

Every response should contain:

{
success,
message,
data,
meta
}

Never expose database errors directly.

---

# Database Rules

Every table should include:

id

createdAt

updatedAt

createdBy

updatedBy

Soft delete support where applicable.

Never delete important business records permanently.

---

# AI Rules

AI must NEVER directly modify user data.

AI should only:

- Explain
- Suggest
- Predict
- Validate

User confirmation is required before applying AI-generated changes.

---

# Security Rules

Never trust frontend validation.

Backend validates everything.

Never expose:

- Secrets
- API Keys
- Database Credentials

Use RBAC-ready patterns from day one, even if only Admin/User roles exist initially.

---

# Performance Rules

Prefer:

- Server Components
- Lazy Loading
- Dynamic Imports
- Pagination
- Optimized Images

Avoid unnecessary client-side rendering.

---

# Git Rules

Main Branch

Production only.

Development Branch

Active development.

Feature Branch

One feature.

One Pull Request.

One Review.

---

# Documentation Rules

Every module must include:

Purpose

Dependencies

API

Future Scope

Known Limitations

---

# AI Coding Assistant Rules

Before generating code, every AI assistant MUST:

1. Read this document.
2. Follow architecture rules.
3. Follow naming conventions.
4. Follow folder conventions.
5. Never invent architecture.
6. Never add unnecessary dependencies.
7. Never duplicate existing functionality.
8. Prefer reusable implementations.
9. Ask for clarification if requirements conflict.
10. Generate production-ready code only.

---

# Non-Negotiable Rules

❌ No any types.

❌ No duplicated code.

❌ No inline SQL.

❌ No hardcoded URLs.

❌ No hardcoded secrets.

❌ No business logic inside UI components.

❌ No direct AI provider calls from components.

❌ No direct database access from the frontend.

---

# Success Criteria

GSTPilot should be:

- Easy to maintain
- Easy to extend
- Easy to test
- Easy to deploy
- Easy to understand

Every architectural decision should support these goals.

---

End of Constitution
