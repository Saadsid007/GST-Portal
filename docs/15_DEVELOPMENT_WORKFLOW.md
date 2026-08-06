# GSTPilot Development Workflow

Version: 1.0.0

Status: Active

---

# Purpose

Defines the development lifecycle of GSTPilot.

Every feature must follow this workflow.

---

# Development Lifecycle

Requirement

↓

Specification

↓

Database Design

↓

API Design

↓

UI Design

↓

Implementation

↓

Testing

↓

Review

↓

Documentation

↓

Merge

↓

Deploy

---

# Feature Workflow

Every feature must have

✓ Requirements

✓ API

✓ Database

✓ UI

✓ Tests

✓ Documentation

No feature skips any stage.

---

# Git Branch Strategy

main

Production

develop

Active Development

feature/<feature-name>

New Features

fix/<issue>

Bug Fixes

hotfix/<issue>

Production Fixes

---

# Pull Request Checklist

✓ Build passes

✓ TypeScript passes

✓ ESLint passes

✓ Tests pass

✓ Docs updated

✓ No TODOs

✓ Reviewed

---

# Definition of Done

A task is complete only if

- Feature works
- Tests pass
- Docs updated
- Build passes
- No architecture violations

---

# AI Development Workflow

AI must

Read Documentation

↓

Understand Feature

↓

Generate Code

↓

Run Type Check

↓

Run Lint

↓

Generate Tests

↓

Fix Errors

↓

Update Docs

↓

Stop

---

# Release Process

Development

↓

Testing

↓

Staging

↓

Production

---

# Versioning

Semantic Versioning

Major

Breaking Changes

Minor

New Features

Patch

Bug Fixes

---

# Changelog

Every feature updates

CHANGELOG.md

Never merge undocumented changes.

---

End of Document
