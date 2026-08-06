# GSTPilot AI Architecture

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines the AI architecture of GSTPilot.

Every AI feature must follow this document.

AI is an assistant.

AI is NOT business logic.

---

# AI Philosophy

AI should

✓ Explain

✓ Suggest

✓ Validate

✓ Predict

✓ Help

AI should NEVER

Modify data automatically.

---

# AI Goals

Reduce manual work.

Reduce GST mistakes.

Help beginners.

Improve productivity.

---

# Supported Providers

Primary

Gemini

Future

OpenAI

Claude

Azure OpenAI

Local LLM

Changing providers should require configuration changes only.

---

# AI Layer

UI

↓

AI Service

↓

Prompt Builder

↓

Context Builder

↓

Provider Adapter

↓

LLM

↓

Parser

↓

Response Formatter

No UI component should call an AI provider directly.

---

# AI Modules

Version 1

- AI Chat
- AI Error Explanation
- AI Column Mapping

Version 2

- OCR
- Smart Reconciliation
- AI Analytics
- Compliance Suggestions

---

# Prompt Builder

Every prompt must include

System Prompt

Context

User Prompt

Expected Output Format

Never concatenate strings manually.

---

# Context Builder

Provide only required context.

Never send

Passwords

Tokens

Secrets

Session IDs

Personal data unless required.

---

# Output Format

AI responses should be structured.

Example

Explanation

Reason

Suggested Action

Confidence

---

# Error Handling

If AI fails

↓

Fallback

↓

Show friendly message

↓

Allow user to continue

AI must never block GST workflows.

---

# AI Logging

Log

Provider

Latency

Token Usage

Model

Request ID

Never log sensitive prompts.

---

# Rate Limiting

AI endpoints should be protected.

Future

Quota per Workspace

AI Credits

Usage Analytics

---

# Future AI

OCR

Invoice Classification

Fraud Detection

Risk Score

Auto Categorization

Compliance Advisor

---

# AI Coding Instructions

Never call providers directly.

Always use AI Service.

Always validate AI output.

AI suggestions require user confirmation.

---

End of Document
