# GSTPilot Project Architecture

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines the technical architecture of GSTPilot.

Every developer and AI Coding Assistant MUST follow this architecture.

This document defines:

- Project Structure
- Folder Strategy
- Module Strategy
- Backend Architecture
- Frontend Architecture
- API Architecture
- Data Flow
- Dependency Rules
- Reusable Module Strategy
- Future Scalability

If implementation conflicts with this document,
this document always wins.

---

# Architecture Philosophy

GSTPilot follows

Feature-Based Modular Monolith Architecture.

NOT

Microservices.

NOT

MVC.

NOT

Traditional Layered Architecture.

Reason

- Faster Development
- Easier Maintenance
- Easier Debugging
- Easier AI Generated Code
- Easier Future Expansion

Every business feature lives inside its own module.

Modules communicate only through public interfaces.

---

# High Level Architecture

                    Browser
                        │
                        ▼
                 Next.js App Router
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼

Server Components Client UI API Routes
│ │ │
└───────────────┼────────────────┘
▼
Business Services
│
┌───────────────┼────────────────┐
│ │ │
▼ ▼ ▼
Prisma ORM AI Service Storage Layer
│
▼
PostgreSQL

---

# Technology Stack

Framework

Next.js Latest

Language

TypeScript

Styling

Tailwind CSS

UI Library

shadcn/ui

Headless Components

Radix UI

Icons

Lucide React

Animations

Framer Motion

Forms

React Hook Form

Validation

Zod

ORM

Prisma

Database

PostgreSQL

State

Zustand

Tables

TanStack Table

Charts

Recharts

Authentication

Better Auth (preferred)

Storage

Cloudflare R2
or AWS S3

Payments

Razorpay

AI

Provider Abstraction Layer

Logging

Pino

---

# Folder Structure

Root

```

src/
app/
features/
components/
lib/
services/
hooks/
config/
types/
middleware/
styles/
prisma/

```

The app directory is ONLY responsible for routing.

Business logic MUST NOT live inside app.

---

# App Directory

Responsible only for:

- Routes
- Layouts
- Route Groups
- API Endpoints
- Metadata
- Error Pages
- Loading Pages

Nothing else.

---

# Features Directory

Every feature owns itself.

Example

```

features/

auth/

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

```

Every feature contains

```

feature/

components/

hooks/

services/

schemas/

types/

utils/

constants/

actions/

api/

index.ts

```

Nothing outside.

---

# Components Directory

Only reusable UI.

Never business logic.

```

components/

ui/

layout/

tables/

forms/

dialogs/

charts/

navigation/

feedback/

```

---

# Services

Global reusable services.

```

services/

ai/

storage/

notification/

payment/

api/

```

---

# Lib

Core utilities.

```

lib/

prisma/

auth/

env/

logger/

permissions/

cache/

helpers/

```

---

# Config

Central configuration.

```

config/

theme.ts

navigation.ts

constants.ts

roles.ts

permissions.ts

app.ts

```

---

# API Architecture

Every API belongs to a feature.

Example

```

api/

auth/

clients/

gstin/

invoice/

reports/

ai/

billing/

```

Every endpoint follows REST conventions.

GET

POST

PATCH

DELETE

Never mix unrelated functionality.

---

# Module Architecture

Every feature is independent.

Each feature owns:

UI

Validation

Services

Types

API

Database Access

Business Logic

No module should directly modify another module's internals.

---

# Dependency Rules

Allowed

Feature

↓

Shared Components

↓

Services

↓

Lib

↓

Database

Not Allowed

Feature

↓

Another Feature's Private Files

Instead

Use

Public Interface

(index.ts)

---

# Reusable Module Strategy

Every module must expose only public exports.

Example

```

features/invoice/index.ts

```

Never import internal files directly.

Correct

```

import { InvoiceTable } from "@/features/invoice";

```

Wrong

```

import InvoiceTable from "@/features/invoice/components/table";

```

---

# State Management

Local State

React

Global State

Zustand

Server State

Server Components

Avoid unnecessary client state.

---

# Data Flow

Browser

↓

Page

↓

Feature

↓

Service

↓

Prisma

↓

Database

Never

Component

↓

Database

---

# Validation Flow

Request

↓

Zod

↓

Business Validation

↓

Database

↓

Response

Validation happens before business logic.

Always.

---

# Error Handling

Every feature has

Custom Errors

Validation Errors

Business Errors

Unexpected Errors

Never expose stack traces to users.

---

# Logging

Log

Authentication

Uploads

Errors

AI Calls

Payments

Never log:

Passwords

Tokens

Secrets

Sensitive Data

---

# AI Architecture

Never call AI directly.

Use

```

UI

↓

AI Service

↓

Prompt Builder

↓

LLM Provider

↓

Parser

↓

Response

```

Changing AI provider should require changing one service only.

---

# Storage Architecture

Uploads

↓

Storage Service

↓

Cloud Storage

Never upload directly from components.

---

# Authentication Flow

Browser

↓

Middleware

↓

Session Validation

↓

Permission Check

↓

Feature Access

↓

Response

Every request passes middleware.

---

# Permission Architecture

Even Version 1 should support:

Admin

User

The permission engine must support future roles without rewriting code.

Future

CA

Manager

Accountant

Viewer

Reviewer

---

# Database Access

Never write SQL inside features.

All database access happens through Prisma.

---

# Caching Strategy

Future Ready

Redis can be added later.

No feature should depend directly on Redis.

Always use Cache Service.

---

# Notification Strategy

Feature

↓

Notification Service

↓

Email

SMS

WhatsApp

Push

Never call providers directly.

---

# File Upload Strategy

UI

↓

Upload Service

↓

Validation

↓

Storage

↓

Database

Never upload files directly from pages.

---

# Performance Rules

Prefer

Server Components

Streaming

Lazy Loading

Pagination

Dynamic Imports

Avoid

Large Client Components

---

# Future Scalability

Every module should be extractable into a microservice without changing business logic.

This is why:

- Services
- Validation
- APIs

remain independent.

---

# Testing Strategy

Every feature should support:

Unit Tests

Integration Tests

API Tests

Future

E2E Tests

---

# Import Rules

Always use aliases.

Correct

```

@/features/invoice

```

Wrong

```

../../../../invoice

```

---

# Environment Variables

Never use

process.env

directly.

Always use

lib/env.ts

---

# Design Principle

Every new feature should require:

Minimal changes

Maximum reuse

Zero breaking changes

---

# AI Coding Instructions

Before generating code:

1. Read Constitution.
2. Read System Overview.
3. Read Product Terminology.
4. Read Architecture.
5. Follow folder structure.
6. Never violate dependency rules.
7. Never duplicate code.
8. Prefer reusable abstractions.
9. If architecture conflict exists, stop and ask.
10. Generate production-ready code only.

---

End of Document
