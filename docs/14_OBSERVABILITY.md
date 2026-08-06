# GSTPilot Observability

Version: 1.0.0

Status: Active

---

# Purpose

This document defines monitoring, logging, metrics and tracing.

Every production system must be observable.

---

# Philosophy

If you cannot observe it,

you cannot debug it.

---

# Logging

Use

Pino

Never use

console.log

in production.

---

# Log Levels

info

warn

error

debug (development)

fatal

---

# Every Log Must Include

Timestamp

Workspace

User

Route

Request ID

Correlation ID

Duration

---

# Metrics

Track

API Response Time

Database Queries

Upload Time

AI Latency

JSON Generation Time

Errors

Success Rate

---

# Tracing

Future

OpenTelemetry

Distributed Tracing

Trace ID

Span ID

Keep instrumentation provider-agnostic so you can switch monitoring backends later. Next.js supports OpenTelemetry instrumentation out of the box. :contentReference[oaicite:0]{index=0}

---

# Error Monitoring

Future

Sentry

Every exception should include

Stack

Route

Workspace

User

Correlation ID

---

# Health Checks

Expose

/api/health

Checks

Database

Storage

AI Provider

Queue

Future

Cache

---

# Analytics

Future

PostHog

Track

Login

Uploads

Generated Returns

AI Usage

Feature Adoption

---

# Performance

Monitor

Slow Queries

Large Uploads

Memory

CPU

Latency

---

# Alerts

Future

Slack

Email

SMS

Critical alerts

Database Down

Storage Failure

AI Failure

---

# Dashboards

Operations

Product

Business

AI

System Health

---

# AI Coding Instructions

Every service should expose logs.

Every API should measure duration.

Every unexpected error should be logged.

Never log secrets.

---

End of Document
