# GSTPilot Deployment Guide

Version: 1.0.0

Status: Active

---

# Purpose

Defines deployment architecture.

---

# Environments

Development

↓

Testing

↓

Staging

↓

Production

---

# Deployment Target

Frontend

Next.js

Backend

Next.js Route Handlers

Database

PostgreSQL

Storage

Cloudflare R2

Future

AWS S3

---

# CI/CD

GitHub

↓

GitHub Actions

↓

Build

↓

Type Check

↓

Lint

↓

Tests

↓

Deploy

---

# Secrets

Store only in

Environment Variables.

Never commit secrets.

---

# Deployment Checklist

✓ Build

✓ Type Check

✓ Tests

✓ Database Migration

✓ Backup

✓ Health Check

✓ Monitoring

---

# Rollback

Keep previous deployment.

Rollback should take less than 5 minutes.

---

# Database

Run

Prisma Migrations

before deployment.

Never modify production schema manually.

---

# Monitoring

Future

Sentry

OpenTelemetry

PostHog

Health Endpoint

---

# Production Checklist

✓ HTTPS

✓ Secure Cookies

✓ CSP

✓ Logging

✓ Backups

✓ Alerts

✓ CDN

---

# Deployment Rules

Production deployment

only from

main branch.

---

End of Document
