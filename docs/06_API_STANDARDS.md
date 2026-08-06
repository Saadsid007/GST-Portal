# GSTPilot API Standards

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines the API standards for GSTPilot.

Every API MUST follow these standards.

No endpoint may violate this document.

---

# API Philosophy

GSTPilot follows

RESTful API Design.

Rules

✓ Predictable

✓ Consistent

✓ Versioned

✓ Secure

✓ Reusable

✓ Documented

---

# Base URL

/api/v1

Examples

/api/v1/auth/login

/api/v1/clients

/api/v1/invoices

/api/v1/reports

Never expose APIs without versioning.

---

# HTTP Methods

GET

Retrieve

POST

Create

PATCH

Partial Update

PUT

Full Replace

DELETE

Soft Delete

Never use POST for updates.

Never use GET to modify data.

---

# URL Naming

Use

Plural nouns

Correct

/clients

/invoices

/reports

/gstins

Wrong

/getClients

/createInvoice

/deleteClient

URLs represent resources.

Actions are represented by HTTP methods.

---

# Nested Resources

Allowed

/api/v1/clients/{clientId}/gstins

/api/v1/invoices/{invoiceId}/items

Not Allowed

Deep nesting beyond two levels.

---

# Standard Response

Every successful response

```json
{
  "success": true,
  "message": "Client created successfully.",
  "data": {},
  "meta": {}
}
```

---

# Error Response

```json
{
  "success": false,
  "message": "Validation failed.",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Email is required."
      }
    ]
  }
}
```

Never expose stack traces.

---

# HTTP Status Codes

200 OK

201 Created

204 No Content

400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

422 Validation Error

429 Too Many Requests

500 Internal Server Error

Use the correct HTTP status.

---

# Pagination

Default

?page=1&limit=20

Response

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 540,
    "totalPages": 27,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

Future

Cursor pagination

---

# Sorting

Example

?sortBy=createdAt

?order=desc

Allowed

asc

desc

---

# Filtering

Examples

?status=ACTIVE

?clientId=123

?gstin=09ABCDE1234A1Z5

Filters should be combinable.

---

# Searching

Global search

?q=amazon

Never create

/search

endpoint.

Use query parameters.

---

# Authentication

Protected APIs require

Bearer Token

Authorization

Bearer <token>

Public APIs

Login

Signup

Forgot Password

Verify Email

Health Check

---

# Authorization

Every request

↓

Authentication

↓

Permission Check

↓

Business Validation

↓

Execution

---

# API Versioning

Current

v1

Future

v2

Breaking changes require

new version.

Non-breaking changes remain in current version.

---

# Validation

Every request

↓

Zod Schema

↓

Business Rules

↓

Database

Never trust frontend validation.

---

# File Upload

Multipart Form Data

Supported

Excel

CSV

Future

PDF

ZIP

Images

Maximum size configured centrally.

---

# Rate Limiting

Future Ready

Authentication

More strict

Public

More relaxed

429

Too Many Requests

---

# Idempotency

Create operations

may support

Idempotency-Key

Future

Payment

Import

Bulk Upload

---

# OpenAPI

Every endpoint

must be documented.

OpenAPI Specification

is the source of truth.

---

# Naming Convention

JSON keys

camelCase

Example

invoiceNumber

createdAt

workspaceId

Never mix

snake_case

PascalCase

---

# Dates

ISO 8601

Example

2026-07-31T15:45:00Z

Never send locale-specific dates.

---

# Booleans

true

false

Never use

0

1

Yes

No

---

# UUID

Every ID

UUID

Never expose sequential IDs.

---

# Error Codes

AUTH_INVALID_TOKEN

AUTH_SESSION_EXPIRED

VALIDATION_ERROR

CLIENT_NOT_FOUND

GSTIN_NOT_FOUND

INVOICE_DUPLICATE

REPORT_NOT_FOUND

AI_PROVIDER_ERROR

UPLOAD_FAILED

Only predefined error codes.

---

# API Documentation

Every endpoint must define

Purpose

Authentication

Request

Response

Errors

Examples

Future Scope

---

# Logging

Log

Method

URL

Duration

Status

Workspace

User

Never log

Passwords

Tokens

Secrets

---

# Security Headers

Future

CORS

CSP

Rate Limit Headers

Cache Control

---

# AI Rules

AI endpoints

must never

modify data automatically.

AI only returns

Suggestions

Explanations

Predictions

User confirmation required for changes.

---

# Development Rules

Every new endpoint

must include

Validation

Authentication

Authorization

Logging

Documentation

Tests

---

# AI Coding Instructions

Before creating an endpoint

Verify

Route

Method

Validation

Permissions

Response Format

Error Format

Never invent custom response structures.

Always follow this document.

---

End of Document
