# GSTPilot Database Design

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines the database architecture of GSTPilot.

This is NOT a Prisma schema.

This document defines:

- Database Philosophy
- Naming Standards
- Relationships
- Constraints
- UUID Strategy
- Indexing Strategy
- Audit Strategy
- Soft Delete Strategy
- Multi Workspace Strategy
- Migration Strategy

Every Prisma model MUST follow this document.

---

# Database Philosophy

GSTPilot uses

PostgreSQL

with

Prisma ORM.

Database design should prioritize:

✓ Scalability

✓ Performance

✓ Maintainability

✓ Readability

✓ Future Expansion

---

# Database Principles

Rule 1

One business entity = One table.

Never mix multiple entities.

---

Rule 2

Every record belongs to a Workspace.

Workspace isolation starts from Day 1.

---

Rule 3

Use explicit relationships.

Never rely on implicit data.

---

Rule 4

Normalize business data.

Do not duplicate information unnecessarily.

---

Rule 5

History is valuable.

Never permanently remove important business data.

---

# Database Hierarchy

Workspace

↓

User

↓

Client

↓

GSTIN

↓

Party

↓

Invoice

↓

Invoice Item

↓

Return

↓

Report

↓

Activity

---

# Primary Key Strategy

Every table uses

UUID

Example

id

UUID

Generated automatically.

Never use auto increment IDs.

Reason

- Better distributed systems support
- Easier imports/exports
- Safer public identifiers

---

# Naming Convention

Prisma Model

PascalCase

Example

Workspace

Client

Invoice

Party

Database Table

snake_case

Examples

workspace

client

invoice

party

Use Prisma `@@map` where needed if database naming differs from model naming. :contentReference[oaicite:1]{index=1}

---

# Column Naming

camelCase in Prisma

snake_case in PostgreSQL if mapped.

Examples

createdAt

updatedAt

deletedAt

workspaceId

clientId

invoiceNumber

---

# Standard Columns

Every business table MUST contain

id

createdAt

updatedAt

createdBy

updatedBy

status

Optional

deletedAt

deletedBy

---

# Ownership Rule

Every table must know

Who owns it.

Normally

workspaceId

Example

Invoice

↓

workspaceId

clientId

gstinId

partyId

---

# Relationship Rules

Workspace

1

↓

Many Users

Workspace

1

↓

Many Clients

Client

1

↓

Many GSTIN

GSTIN

1

↓

Many Parties

Party

1

↓

Many Invoices

Invoice

1

↓

Many Invoice Items

Invoice

↓

Return

↓

Report

Always define both sides of relationships in Prisma for clarity and maintainability. :contentReference[oaicite:2]{index=2}

---

# Soft Delete

Business tables

must support

Soft Delete.

Never permanently delete

Invoices

Returns

Reports

Clients

GSTIN

Use

deletedAt

deletedBy

---

# Status Strategy

Every table should use Status.

Example

ACTIVE

INACTIVE

ARCHIVED

DRAFT

VALIDATED

GENERATED

Never use random strings.

Enums preferred when values are fixed. :contentReference[oaicite:3]{index=3}

---

# Audit Strategy

Every important action should be traceable.

Store

Who

What

When

Old Value

New Value

Reason

Audit table.

---

# Versioning

Future Ready.

Invoice

v1

↓

v2

↓

v3

Support history without replacing records.

---

# File Storage

Files are NEVER stored in PostgreSQL.

Database stores

URL

Metadata

Checksum

Size

Storage

Cloud Storage.

---

# JSON Storage

JSON columns are allowed only when:

Schema is dynamic

Examples

AI Metadata

Provider Response

Import Mapping

Do NOT store structured business data as JSON.

---

# Indexing Strategy

Index

workspaceId

clientId

gstinId

invoiceNumber

createdAt

status

filingPeriod

partyId

Index relation fields and frequently filtered fields to avoid full table scans. :contentReference[oaicite:4]{index=4}

---

# Unique Constraints

Examples

Workspace Slug

GSTIN

Invoice Number
(within GSTIN + Filing Period if applicable)

Email

Subscription ID

Never create duplicate unique constraints.

---

# Foreign Keys

Always use foreign keys.

Never store plain IDs without relationships.

---

# Transactions

Use database transactions when

Creating Invoice

Creating Invoice Items

Generating Return

Generating Reports

Payment Processing

Never partially save business operations.

---

# Migration Rules

Every schema change

↓

Migration

↓

Review

↓

Test

↓

Deploy

Never edit production schema manually.

---

# Seed Data

Only development data.

Never seed production.

---

# Multi Workspace Strategy

Every query must filter

workspaceId

Never expose another workspace's data.

Future

Row Level Security

can be added.

---

# Prisma Rules

One Prisma Client.

Never instantiate multiple clients.

Use organized schema files by domain as the project grows.

---

# Schema Implementation

The production Prisma schema lives at `prisma/schema.prisma`.

Generated client output: `src/generated/prisma`.

Database utilities: `src/lib/database/`.

Initial migration: `prisma/migrations/20260731180000_init_gstpilot_database/`.

### Model inventory

| Domain             | Models                                                             |
| ------------------ | ------------------------------------------------------------------ |
| Auth (Better Auth) | User, Session, Account, Verification                               |
| Identity           | Workspace, Profile                                                 |
| RBAC               | Role, Permission, RolePermission, UserRole                         |
| Billing            | Subscription                                                       |
| GST Hierarchy      | Client, Gstin, Party, Invoice, InvoiceItem, GstReturn, Report      |
| Platform           | Upload, ActivityLog, Notification, ApiKey, AiConversation, AiUsage |

The `Return` entity is mapped to table `gst_return` to avoid SQL reserved word conflicts.

---

# Backup Strategy

Daily

Weekly

Monthly

Point In Time Recovery

Future

Automated Backups

---

# Performance Rules

Avoid

N+1 Queries

Large SELECT *

Full Table Scans

Missing Indexes

Prefer pagination over loading entire datasets.

---

# Future Expansion

Database should support

OCR

AI

Team Members

Permissions

White Label

Integrations

API Tokens

without redesign.

---

# AI Coding Instructions

Before creating a Prisma model

Verify

Entity

Relationships

Indexes

Ownership

Status

Audit

Soft Delete

If any rule is violated

Stop

Ask for clarification.

---

End of Document
