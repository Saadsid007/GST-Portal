# GSTPilot Domain Model

Version: 1.0.0

Status: Active

---

# Purpose

This document defines the business entities of GSTPilot.

Every table,
API,
feature,
UI,
and service
must follow this model.

This document describes business concepts.

It is NOT a database schema.

---

# Domain Hierarchy

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

# Rule

Every entity must have

- Identity
- Ownership
- Lifecycle
- Relationships

before implementation.

---

# Workspace

Represents

A business account.

Owns

Users

Clients

Subscriptions

Settings

Future

Teams

Permissions

Branches

---

# User

Represents

A person using GSTPilot.

Owns

Profile

Preferences

Sessions

Activity

Future

Roles

Permissions

Invitations

---

# Client

Represents

A customer managed inside GSTPilot.

Owns

GSTINs

Returns

Reports

Invoices

Notes

---

# GSTIN

Represents

GST Registration.

Owns

Invoices

Returns

Tax Periods

Validation

---

# Party

Represents

Customer

Supplier

Vendor

Distributor

Stores

GSTIN

PAN

State

Address

Contact

Credit Limit (Future)

Risk Score (Future)

---

# Invoice

Represents

One GST Transaction.

Owns

Invoice Items

Taxes

Validation

Attachments

History

---

# Invoice Item

Represents

One product/service line.

Contains

Description

Quantity

Rate

HSN

Tax

Amount

---

# Upload

Represents

One uploaded file.

Owns

Original File

Parsed Data

Validation Result

Import History

---

# Validation

Represents

Validation results.

Contains

Errors

Warnings

Suggestions

AI Explanation

---

# Compliance Engine

Consumes

Validated Data.

Produces

GST Structures.

Owns

Business Rules.

---

# Return

Represents

Generated GST Return.

Examples

GSTR1

Future

GSTR3B

GSTR9

---

# Report

Represents

Generated reports.

Examples

Sales

Purchase

Summary

JSON

Excel

PDF (Future)

---

# Subscription

Represents

Billing Plan.

Owns

Limits

GSTIN Count

Client Count

AI Credits

Storage

---

# Activity

Represents

Timeline.

Stores

Who

What

When

Where

---

# Notification

Represents

User alerts.

Future

Email

SMS

WhatsApp

Push

---

# AI Conversation

Represents

AI interactions.

Stores

Prompt

Context

Response

Tokens

Provider

---

# Relationships

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

Many GSTINs

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

Validation

↓

Return

↓

Report

---

# Entity Rules

Every entity must contain

id

createdAt

updatedAt

createdBy

updatedBy

status

---

# Soft Delete

Business entities

must never be permanently deleted.

Use

deletedAt

when applicable.

---

# Future Expansion

Every entity should support

Audit

Versioning

History

AI

Attachments

without schema redesign.

---

# AI Coding Rules

Before creating a database table

Verify

Does this entity already exist?

Does it belong to another entity?

Can it reuse an existing relationship?

Never create duplicate business entities.

---

End of Document
