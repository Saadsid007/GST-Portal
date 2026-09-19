# GSTPilot Testing Strategy

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines the complete testing strategy for GSTPilot.

Every module,
API,
Server Action,
UI component,
database operation,
AI feature,
and business workflow

must follow this document.

Testing is mandatory.

---

# Testing Philosophy

GSTPilot follows

Shift Left Testing.

Testing starts

before

development finishes.

A feature is NOT complete until

- Code Compiles
- Type Check Passes
- Lint Passes
- Tests Pass
- Documentation Updated

---

# Testing Pyramid

            E2E
             ▲
      Integration
             ▲

Unit + Component Tests

Most tests should be

Unit

Fewer

Integration

Only important workflows

E2E

---

# Testing Stack

Unit Testing

Vitest

Component Testing

React Testing Library

Integration Testing

Vitest

End-to-End Testing

Playwright

Mocking

MSW

Coverage

Vitest Coverage

---

# Folder Structure

tests/

unit/

integration/

e2e/

fixtures/

helpers/

mocks/

---

# Unit Testing

Test

Functions

Utilities

Hooks

Validation

Business Rules

Never test implementation details.

Test behavior.

---

# Component Testing

Test

Rendering

Props

User Interaction

Loading

Errors

Accessibility

Dark Mode

Responsive behavior (when applicable)

---

# Integration Testing

Test

API + Database

Service + Repository

Validation + Business Rules

Authentication + Authorization

File Upload + Processing

---

# E2E Testing

Critical user flows

Login

Register

Create Client

Add GSTIN

Upload Excel

Validate Data

Generate JSON

Download Report

Logout

Run E2E against a production-like build whenever possible.

---

# Async Server Components

Prefer

Playwright

for

Async Server Components.

Avoid relying on unit tests for async Server Component rendering.

---

# Mocking Rules

Mock

AI Providers

Email

SMS

Payment Gateway

Cloud Storage

Never mock

Core Business Logic

Validation

Domain Rules

---

# Fixtures

Create reusable

Clients

Invoices

GSTINs

Parties

Returns

Reports

Never duplicate fixtures.

---

# Test Naming

describe

↓

feature

↓

scenario

↓

expected result

Example

Invoice Validation

should reject duplicate invoice numbers

---

# Coverage Targets

Overall

90%

Business Logic

95%

Validation

100%

Critical APIs

100%

Utilities

100%

Coverage should guide quality,

not become the only goal.

---

# API Testing

Every endpoint

must verify

Authentication

Authorization

Validation

Success

Failure

Permissions

Edge Cases

---

# Database Testing

Verify

Relationships

Constraints

Transactions

Rollback

Workspace Isolation

Soft Delete

---

# Security Testing

Verify

Unauthorized Access

Permission Denied

Session Expiry

CSRF Protection

File Upload Validation

Rate Limiting (future)

---

# UI Testing

Verify

Loading State

Empty State

Error State

Success State

Keyboard Navigation

Accessibility

Dark Mode

---

# AI Testing

Test

Prompt Builder

Response Parsing

Fallback Logic

Provider Failures

Timeouts

Never depend on live AI APIs in automated tests.

---

# Performance Testing

Future

Large Uploads

Large Tables

Pagination

Database Queries

Concurrent Users

---

# Regression Testing

Every bug

must receive

a regression test

before closing.

---

# CI/CD Rules

Every Pull Request

must pass

Type Check

Lint

Unit Tests

Integration Tests

E2E (critical flows)

No failing tests may be merged.

---

# Test Data

Use

Factories

Fixtures

Seed Data

Never use production data.

---

# Flaky Tests

If flaky

Fix

or

Disable with documented reason.

Never ignore flaky tests.

---

# Definition of Done

A feature is complete only when

✓ Build Passes

✓ TypeScript Passes

✓ ESLint Passes

✓ Unit Tests Pass

✓ Integration Tests Pass

✓ E2E Tests Pass (where applicable)

✓ Documentation Updated

✓ No TODOs

---

# Corpus Verification

Unit tests prove a function does what it was written to do. They cannot prove
the engine reads a real seller's files correctly, because the fixtures are
written by the same person as the code.

The `Sample/` corpus is the answer to that. Each folder is a different
business with a different mix of marketplaces, own invoices and stock
transfers, and most also contain the return the CA actually filed — which
makes them the only ground truth in the project.

Two harnesses run against it. Both read only; neither writes into `Sample/`.
Neither runs in CI, because the corpus is not in the repository: run them
locally after any change to an adapter, the detector, the transformation
engine, or the GSTR-1 generators.

```bash
pnpm verify:corpus            # all folders
pnpm verify:corpus "new 19"   # one folder
pnpm verify:pdfs              # all sample PDFs
```

**`verify:corpus`** runs every workbook through the real import pipeline and
reconciles the result against the CA's filed return. A folder reports
`MATCHES` only when no invoice mismatches, nothing is ours alone, and the
B2CS drift is exactly zero. Folders holding more than one client's books are
excluded rather than compared, because every input is pooled into one
conversion and no single client's return could match.

**`verify:pdfs`** has no reference copy to compare against, so it checks each
extracted invoice against the arithmetic every invoice satisfies:

- `taxable + tax = total` — the figures describe one document
- `tax / taxable` lands on a notified slab
- IGST or CGST+SGST, never both; CGST equals SGST

A layout read wrongly almost always breaks one of these. That is how a wrong
figure becomes visible without knowing the right one.

A change that leaves unit tests green but moves a folder from `MATCHES` to
`DIFFERS` has broken something no unit test was watching. Treat that as a
failure.

**`pnpm harvest:columns`** is a diagnostic rather than a check: it profiles
every column in the corpus, labels what it can from the canonical alias list,
and reports the engine's top-1 accuracy per field. Use it before changing
field discovery, to know what the change has to beat.

---

# AI Coding Instructions

Before generating code

Generate tests

Run tests

Fix failures

Repeat

Until all tests pass

Never generate production code without corresponding tests.

---

End of Document
