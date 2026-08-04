<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before writing any Next.js code:

1. Read the relevant documentation inside

node_modules/next/dist/docs/

Do NOT rely on training data.

The bundled documentation is the source of truth.

<!-- END:nextjs-agent-rules -->

# ============================================================

# GSTPilot AI Engineering Guide

# ============================================================

Project

GSTPilot

Mission

Build a production-grade AI-powered GST Compliance Platform.

The project must scale from

Individual

↓

CA Firms

↓

Enterprise

↓

White Label

↓

Public API

↓

ERP Integrations

This repository follows Engineering First principles.

Architecture decisions are more important than writing code quickly.

============================================================

PROJECT DOCUMENTATION

============================================================

Always read these documents before coding.

Priority Order

1.

docs/00_PROJECT_CONSTITUTION.md

2.

docs/01_SYSTEM_OVERVIEW.md

3.

docs/01.5_PRODUCT_TERMINOLOGY.md

4.

docs/02_PROJECT_ARCHITECTURE.md

5.

docs/03_FOLDER_STRUCTURE.md

6.

docs/04_DOMAIN_MODEL.md

7.

docs/05_DATABASE_DESIGN.md

8.

docs/06_API_STANDARDS.md

9.

docs/07_ENGINEERING_STANDARDS.md

10.

docs/08_UI_DESIGN_SYSTEM.md

11.

docs/09_SECURITY_MODEL.md

12.

docs/10_AUTH_SYSTEM.md

13.

docs/11_ERROR_HANDLING.md

14.

docs/12_TESTING_STRATEGY.md

15.

docs/13_DEVELOPMENT_WORKFLOW.md

16.

docs/14_DEPLOYMENT.md

17.

docs/15_ROADMAP.md

============================================================

TECH STACK

============================================================

Framework

Next.js App Router

Language

TypeScript Strict

Package Manager

pnpm

Database

PostgreSQL

ORM

Prisma

Authentication

Better Auth

Styling

TailwindCSS

UI

shadcn/ui

State

Zustand

Validation

Zod

Forms

React Hook Form

Animation

Framer Motion

Charts

Recharts

Tables

TanStack Table

Testing

Vitest

Playwright

Logging

Pino

Storage

Cloudflare R2

Payments

Razorpay

============================================================

ARCHITECTURE

============================================================

Feature Based Modular Monolith

Every feature owns

• Components

• Services

• Validation

• Types

• APIs

• Tests

Never bypass architecture.

Never invent folder structures.

============================================================

WORKFLOW

============================================================

Understand

↓

Plan

↓

Explain

↓

Implement

↓

Type Check

↓

Lint

↓

Test

↓

Document

↓

Stop

Never skip steps.

============================================================

CODING RULES

============================================================

Always

✓ Strict TypeScript

✓ Reusable Components

✓ Reusable Hooks

✓ Reusable Services

✓ Zod Validation

✓ Server Components by default

✓ Accessibility

✓ Responsive UI

Never

❌ any

❌ console.log

❌ Dead Code

❌ Hardcoded Secrets

❌ Relative Imports

❌ Business Logic inside Components

❌ Raw SQL

============================================================

DATABASE

============================================================

Always

Prisma

UUID

Workspace Isolation

Soft Delete

Audit Fields

Transactions

Never

Direct SQL

============================================================

API

============================================================

REST

/api/v1

Every endpoint

Validation

↓

Authentication

↓

Authorization

↓

Business Logic

↓

Database

↓

Logging

↓

Response

============================================================

SECURITY

============================================================

Always

Validate Input

Check Permissions

Verify Workspace

Secure Cookies

HttpOnly

Never expose

Secrets

Passwords

Tokens

Stack Traces

============================================================

UI

============================================================

Design Language

Stripe

Linear

Vercel

Notion

Always

Dark Mode

Light Mode

Responsive

Accessible

Consistent

Use design tokens only.

============================================================

TESTING

============================================================

Generate

Unit Tests

Integration Tests

E2E Tests

Every feature is incomplete without tests.

============================================================

DOCUMENTATION

============================================================

Every feature must update

README

API Docs

CHANGELOG

Relevant Docs

============================================================

AI RULES

============================================================

Always

Reuse Code

Explain Decisions

Suggest Better Architecture

Ask When Ambiguous

Self Review

Never

Guess

Invent APIs

Invent Database Fields

Break Architecture

============================================================

SELF REVIEW

============================================================

Before finishing

Verify

✓ Build

✓ TypeScript

✓ ESLint

✓ Tests

✓ Architecture

✓ Documentation

✓ Security

✓ Performance

If anything fails

Fix

Then respond.

============================================================

OUTPUT QUALITY

============================================================

Everything produced must be

Production Ready

Scalable

Maintainable

Reusable

Documented

Accessible

Tested

Enterprise Grade
