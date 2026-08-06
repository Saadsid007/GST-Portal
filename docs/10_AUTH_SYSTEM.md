# GSTPilot Authentication System

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines the authentication architecture of GSTPilot.

Every login,
logout,
registration,
protected page,
API,
Server Action,
and middleware/proxy

must follow this document.

No authentication logic should exist outside this architecture.

---

# Authentication Philosophy

GSTPilot uses

Better Auth

with

Secure Session Cookies.

Authentication is a platform service.

It is not a feature.

Every module depends on Authentication.

Authentication must remain independent.

---

# Authentication Stack

Library

Better Auth

Framework

Next.js App Router

Session

HttpOnly Secure Cookies

Backend

Next.js Route Handlers

Database

PostgreSQL

ORM

Prisma

---

# Authentication Flow

Visitor

↓

Register

↓

Verify Email

↓

Login

↓

Session Created

↓

Protected Routes

↓

Logout

↓

Session Destroyed

---

# Registration

Required

Full Name

Email

Password

Confirm Password

Optional

Company Name

Workspace Name

Phone Number (Future)

---

# Registration Rules

Email

Unique

Password

Minimum 12 characters

Email verification required before access.

Workspace created automatically.

Default role

Admin

---

# Login

Supports

Email

Password

Future

Google

GitHub

Microsoft

Passkeys

SSO

---

# Logout

Logout

↓

Destroy Session

↓

Clear Cookie

↓

Redirect to Login

Never leave active sessions after logout.

---

# Session Strategy

Use

Secure Cookies

HttpOnly

SameSite=Lax

Secure (HTTPS)

Automatic expiration

Idle timeout (future)

Session refresh handled by Better Auth.

Never store authentication tokens in localStorage.

---

# Better Auth Route

Authentication endpoints live at

/api/auth/[...all]

Do not change the route unless absolutely required.

---

# Protected Routes

Public

/

/login

/register

/forgot-password

/reset-password

/verify-email

Protected

/dashboard

/clients

/gstin

/party

/invoices

/reports

/settings

/admin

---

# Session Validation

Every protected request

↓

Read Session

↓

Validate Session

↓

Check Workspace

↓

Check Permissions

↓

Continue

If invalid

↓

Redirect/Login

---

# Route Protection

Middleware (or Next.js proxy)

only performs lightweight checks.

Protected pages

must validate the session again.

Never rely only on middleware/proxy for authorization. Better Auth recommends optimistic cookie checks in middleware/proxy and full session validation in pages, Route Handlers, or Server Actions. :contentReference[oaicite:1]{index=1}

---

# Email Verification

Required

Before accessing dashboard.

Flow

Register

↓

Verification Email

↓

User Clicks Link

↓

Email Verified

↓

Login Allowed

---

# Forgot Password

Flow

Forgot Password

↓

Email

↓

Reset Link

↓

New Password

↓

Login

Reset tokens expire automatically.

---

# Password Rules

Minimum

12 characters

Must include

Uppercase

Lowercase

Number

Special Character

Never store passwords.

Only hashed passwords.

---

# Session Lifetime

Version 1

Managed by Better Auth defaults.

Future

Remember Me

Device Sessions

Session Revocation

Session Expiration Policy

---

# Workspace Creation

First registration automatically creates

Workspace

↓

User

↓

Profile

↓

Default Settings

↓

Subscription

↓

Activity Log

This ensures every user belongs to a Workspace from Day 1.

---

# Authorization

Authentication verifies identity.

Authorization verifies permissions.

Never combine these concepts.

Future permission model

Admin

Manager

CA

Accountant

Viewer

Reviewer

Permissions

client.create

client.update

invoice.generate

report.export

Never check roles directly in business logic.

Always check permissions.

---

# Server Components

Protected Server Components

must validate the session on the server.

Never trust client state.

---

# Server Actions

Every Server Action

must validate

Session

Workspace

Permission

before execution.

---

# API Authentication

Protected APIs require

Valid Session

Workspace Validation

Permission Validation

Business Validation

---

# OAuth (Future)

Supported

Google

GitHub

Microsoft

Apple

No architecture changes required.

---

# MFA (Future)

Supported

Authenticator Apps

Email OTP

Passkeys

Recovery Codes

---

# Organization Support (Future)

One user

↓

Multiple Workspaces

↓

Workspace Switcher

Current Version

One user

↓

One Workspace

---

# Security

Never expose

Session IDs

Tokens

Secrets

Cookies are HttpOnly.

No frontend access.

---

# Logging

Authentication events

Register

Login

Logout

Failed Login

Password Reset

Email Verification

Stored in Activity Logs.

---

# AI Rules

AI never performs authentication.

AI never accesses session secrets.

AI never bypasses permissions.

---

# Error Messages

User

"Invalid email or password."

Developer

Detailed logs.

Never reveal whether an email exists.

---

# Future Features

Google Login

GitHub Login

Microsoft Login

Passkeys

Magic Links

Device Management

Session Dashboard

Multi Workspace

Organization Invites

---

# AI Coding Instructions

Before implementing authentication

Verify

- Better Auth configuration
- Secure cookies
- Session validation
- Workspace creation
- Email verification
- Permission checks

Never create custom authentication unless explicitly approved.

---

End of Document
