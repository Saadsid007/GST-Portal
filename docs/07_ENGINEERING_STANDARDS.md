# GSTPilot Engineering Standards

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines engineering standards for GSTPilot.

Every developer and AI Coding Assistant MUST follow these rules.

These rules are mandatory.

---

# Engineering Philosophy

Every line of code should be

- Readable
- Reusable
- Predictable
- Testable
- Maintainable

Never optimize for writing code quickly.

Always optimize for maintaining it for years.

---

# TypeScript Rules

Always use

Strict Mode

Never disable TypeScript errors.

Never use

any

Allowed only when approved.

Prefer

unknown

or

generic types.

Use

type

for unions.

Use

interface

for extendable object contracts.

Always export types.

---

# File Naming

Folders

kebab-case

Files

kebab-case

React Components

PascalCase

Hooks

useSomething.ts

Schemas

something.schema.ts

Types

something.types.ts

Constants

something.constants.ts

Services

something.service.ts

Repositories

something.repository.ts

---

# Component Rules

One component

One responsibility.

Maximum

250 lines.

Split larger components.

Never place business logic inside UI.

---

# Hooks

Feature hooks remain inside feature.

Global hooks

↓

src/hooks

Never call APIs directly inside components.

---

# Server Components

Default

Server Components.

Client Components only when needed.

Use

"use client"

sparingly.

---

# Imports

Order

Node

Third Party

Aliases

Relative

Alphabetical

Always use

@/

Never

../../../

---

# Functions

Maximum

50 lines

If larger

Extract function.

Function names

Must be verbs.

Examples

createClient

generateReturn

validateInvoice

Never

doStuff

handleData

temp

---

# Variables

Use descriptive names.

Bad

x

a

temp

Good

invoiceNumber

partyName

workspaceId

---

# Constants

Never hardcode values.

Move to

config/

or

constants/

---

# Environment Variables

Never use

process.env

directly.

Always use

lib/env.ts

Validate with Zod.

---

# API Calls

Frontend

↓

Feature Service

↓

API Route

↓

Business Service

↓

Database

Never

Component

↓

Database

---

# Error Handling

Never swallow errors.

Always

Catch

Log

Return meaningful response

No empty catch blocks.

---

# Logging

Use centralized logger.

Never

console.log

in production code.

Log levels

info

warn

error

debug (development only)

---

# Async Code

Always use

async/await

Never chain multiple .then() calls.

Wrap async operations in try/catch.

---

# Database

Never write raw SQL unless absolutely necessary.

Prefer Prisma.

Always use transactions for related writes.

---

# Validation

Every input

↓

Zod Schema

↓

Business Validation

↓

Database

Frontend validation is UX.

Backend validation is security.

---

# Forms

Every form

React Hook Form

-

Zod

No exceptions.

---

# State Management

Use

React State

↓

Local

Zustand

↓

Global

Server Components

↓

Server Data

Avoid unnecessary global state.

---

# Reusability

Before writing new code ask

Can this be reused?

If used by

2+

features

move to shared.

---

# Comments

Avoid obvious comments.

Write

Why

not

What

Bad

// increment counter

Good

// GST portal rejects duplicate invoice numbers,
// therefore uniqueness is checked before generation.

---

# Magic Numbers

Forbidden.

Bad

if(limit > 500)

Good

if(limit > MAX_UPLOAD_LIMIT)

---

# Testing Ready

Every feature should be designed to support

Unit Tests

Integration Tests

API Tests

Future

E2E Tests

---

# Accessibility

Every UI must support

Keyboard

Focus States

ARIA Labels

Color Contrast

Screen Readers

---

# Performance

Avoid unnecessary renders.

Memoize only when needed.

Use lazy loading.

Paginate large data.

Optimize images.

---

# Security

Never trust frontend.

Escape user input.

Sanitize uploads.

Validate everything.

---

# Git Standards

Branch

feature/<name>

fix/<name>

refactor/<name>

Commit Format

feat:

fix:

refactor:

docs:

test:

chore:

Follow Conventional Commits.

---

# Code Review Checklist

Before merging

- TypeScript passes
- ESLint passes
- Build passes
- No duplicate code
- Naming conventions followed
- Tests pass
- Documentation updated

---

# AI Coding Rules

Before generating code

1. Read all architecture documents.
2. Reuse existing modules.
3. Never duplicate logic.
4. Follow naming conventions.
5. Generate production-ready code.
6. Explain architectural decisions if needed.
7. Stop and ask if requirements conflict.
8. Do not invent new patterns.

---

# Definition of Done

A task is complete only if

✓ Code Compiles

✓ Type Check Passes

✓ Lint Passes

✓ Documentation Updated

✓ No TODOs

✓ No any Types

✓ No Dead Code

✓ No Console Logs

✓ No Architecture Violations

---

End of Document
