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
