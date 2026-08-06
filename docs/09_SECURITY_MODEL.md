# GSTPilot Security Model

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines the security architecture of GSTPilot.

Every feature,
API,
database query,
file upload,
and AI integration

MUST follow these rules.

Security is never optional.

---

# Security Philosophy

GSTPilot follows

Defense in Depth.

Never trust

- Browser
- User
- Request
- Uploaded Files
- Client Validation

Everything must be verified.

---

# Security Layers

User

↓

Authentication

↓

Session Validation

↓

Authorization

↓

Business Validation

↓

Database Validation

↓

Audit Logging

↓

Response

---

# Core Principles

1.

Authentication

Verifies identity.

2.

Authorization

Verifies permissions.

3.

Validation

Verifies input.

4.

Logging

Records activity.

5.

Encryption

Protects sensitive data.

---

# Workspace Isolation

Every request belongs to

one

Workspace.

Users can never access another workspace.

Every query

MUST

filter

workspaceId.

---

# User Roles (Version 1)

Admin

Full access.

User

Own workspace only.

Future

CA

Manager

Reviewer

Accountant

Viewer

Roles must be extensible without schema redesign.

---

# Permissions

Never check

Role

directly.

Always check

Permission.

Example

client.create

client.read

client.update

client.delete

invoice.generate

report.export

Future roles inherit permissions.

---

# Authentication

Authentication is handled by

Better Auth.

Never implement custom authentication.

Use

Session Cookies

instead of localStorage tokens wherever possible. Better Auth is designed around secure cookie-based sessions, and Next.js recommends using an authentication library rather than building your own. :contentReference[oaicite:1]{index=1}

---

# Authorization

Every request

↓

Authentication

↓

Permission

↓

Workspace

↓

Business Rule

↓

Database

Authorization is mandatory.

---

# Password Policy

Minimum

12 characters.

Require

Uppercase

Lowercase

Number

Special Character

Passwords are never stored.

Only hashes.

---

# Session Rules

Secure Cookies

HttpOnly

SameSite

HTTPS Only

Automatic expiration

Idle timeout support

Future

Multiple device management

Session revocation

---

# API Security

Every protected endpoint requires

Authentication

Authorization

Validation

Logging

Rate Limiting

Never expose internal errors.

---

# Rate Limiting

Version 1

Authentication endpoints

↓

Strict

AI endpoints

↓

Moderate

Public endpoints

↓

Relaxed

Future

Redis

Sliding Window

---

# CSRF

Protect

Forms

Mutations

Sensitive Actions

---

# XSS

Escape all user input.

Never render raw HTML.

Use React defaults.

Sanitize rich text if added in future.

---

# SQL Injection

Use Prisma.

Never concatenate SQL.

Raw SQL requires approval.

---

# File Upload Security

Allowed

Excel

CSV

Future

PDF

Images

Rules

Validate extension.

Validate MIME type.

Validate size.

Scan file before processing (future).

Never execute uploaded content.

---

# Sensitive Data

Sensitive

Passwords

Session Tokens

API Keys

Secrets

Never log

Never expose

Never return

---

# Secrets

Secrets belong only in

Environment Variables.

Never commit secrets.

Never hardcode keys.

---

# Environment Variables

Access only through

lib/env.ts

Validate on startup.

Fail fast if missing.

---

# Encryption

Passwords

Hash

Sensitive tokens

Encrypted at rest when applicable

Future

Field-level encryption for critical data

---

# Audit Logging

Every important action logs

Who

What

When

Workspace

IP (future)

User Agent (future)

Old Value

New Value

---

# AI Security

AI never receives

Secrets

Passwords

Tokens

Sensitive credentials

PII should be minimized before sending to external AI providers.

AI responses are suggestions only.

---

# Download Security

Only authorized users

can download

Reports

JSON

Invoices

Generated files

---

# Error Messages

Users receive

Friendly messages.

Developers receive

Detailed logs.

Never expose

Stack traces

Database errors

Secrets

---

# Dependency Security

Dependencies

Must be

Maintained

Reviewed

Updated regularly

Remove unused packages.

---

# Security Headers

Future

CSP

HSTS

X-Frame-Options

X-Content-Type-Options

Referrer-Policy

---

# Backup Security

Encrypted backups.

Access restricted.

Retention policy defined.

---

# Disaster Recovery

Future

Daily backups

Point-in-time recovery

Recovery documentation

---

# AI Coding Instructions

Before generating code

Verify

Authentication

Authorization

Workspace isolation

Validation

Logging

Error handling

Never bypass security for convenience.

---

End of Document
