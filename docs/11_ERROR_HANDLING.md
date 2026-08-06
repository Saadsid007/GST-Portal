# GSTPilot Error Handling Standards

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines the complete error handling architecture of GSTPilot.

Every feature,
API,
Server Action,
Background Job,
AI Request,
Upload,
and Database Operation

must follow these standards.

---

# Error Philosophy

Errors are part of software.

They should

✓ Be predictable

✓ Be logged

✓ Be understandable

✓ Never expose sensitive information

✓ Help users recover

---

# Error Categories

1.

Validation Errors

User input is invalid.

Example

Email missing

Wrong GSTIN

Duplicate Invoice

---

2.

Business Errors

Business rule violation.

Example

Invoice already exists

Return already generated

GSTIN inactive

---

3.

Authentication Errors

Invalid session

Expired session

Invalid credentials

---

4.

Authorization Errors

User lacks permission.

---

5.

Database Errors

Constraint violation

Connection issue

Transaction failure

---

6.

Upload Errors

Invalid format

File too large

Corrupted file

Unsupported MIME type

---

7.

AI Errors

Provider unavailable

Timeout

Quota exceeded

Malformed response

---

8.

System Errors

Unexpected runtime failures.

These indicate bugs.

---

# Error Flow

Request

↓

Validation

↓

Business Rules

↓

Database

↓

Response

↓

Logging

↓

Monitoring

---

# Standard Error Response

{
"success": false,
"message": "Validation failed.",
"error": {
"code": "VALIDATION_ERROR",
"details": []
}
}

Never invent custom error formats.

---

# Error Codes

AUTH_INVALID_CREDENTIALS

AUTH_SESSION_EXPIRED

AUTH_UNAUTHORIZED

VALIDATION_ERROR

CLIENT_NOT_FOUND

GSTIN_NOT_FOUND

PARTY_NOT_FOUND

INVOICE_DUPLICATE

UPLOAD_INVALID_FILE

UPLOAD_TOO_LARGE

AI_PROVIDER_ERROR

DATABASE_ERROR

UNKNOWN_ERROR

Only predefined codes.

---

# Validation Errors

Return

422

Never

500

---

# Business Errors

Return

409

Examples

Duplicate Invoice

Existing GSTIN

Existing Client

---

# Authentication Errors

Return

401

Never reveal

whether email exists.

---

# Authorization Errors

Return

403

Do not leak permission details.

---

# Not Found

Return

404

Generic message

Resource not found.

---

# Unexpected Errors

Return

500

Log internally.

User receives

"Something went wrong. Please try again."

Never expose stack traces.

---

# Error Logging

Every error logs

Timestamp

Workspace

User

Route

Method

Error Code

Message

Correlation ID

Never log

Passwords

Tokens

Secrets

PII

---

# Correlation ID

Every request receives

X-Correlation-ID

The ID follows the request through

API

Services

Database

Logs

This makes debugging easier.

---

# Error Boundaries

Use

error.tsx

for route-level failures.

Use

global-error.tsx

only as a final fallback.

Expected errors should be handled explicitly instead of relying on error boundaries. Unexpected exceptions should be caught by the nearest error boundary. This matches the App Router guidance.

---

# Server Actions

Expected failures

↓

Return structured response

Unexpected failures

↓

Throw

↓

Handled by error boundary

Never throw for validation failures.

---

# User Messages

Bad

Database constraint failed

Good

This invoice already exists.

Explain

what happened

and

what the user can do next.

---

# Retry Strategy

Allowed

Network timeout

AI timeout

Storage timeout

Not Allowed

Validation failure

Business rule failure

Permission failure

---

# Toast Notifications

Success

Green

Warning

Amber

Error

Red

Info

Blue

Never show raw exception text.

---

# AI Errors

If AI fails

↓

Fallback gracefully

↓

User can continue using the product

AI must never block core GST workflows.

---

# File Upload Errors

Examples

Unsupported file type

Missing columns

Duplicate upload

Corrupted workbook

Provide actionable feedback.

---

# Monitoring

Future

Sentry

OpenTelemetry

Performance Monitoring

Alerting

---

# AI Coding Instructions

Before implementing error handling

Use standard error codes

Return standard response shape

Log server-side

Show user-friendly messages

Do not leak internal details

---

End of Document
