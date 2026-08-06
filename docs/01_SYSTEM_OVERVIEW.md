# GSTPilot - System Overview

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document explains the business side of GSTPilot.

It is intended for:

- AI Coding Assistants
- Developers
- Designers
- Product Managers
- Future Contributors

Before writing any feature, the developer or AI assistant MUST understand this document.

This file explains:

- What GSTPilot is
- Who uses it
- Why it exists
- How the system works
- Complete product workflow
- Business modules
- Future roadmap

This document is NOT technical.

It focuses on product understanding.

---

# What is GSTPilot?

GSTPilot is an AI-powered GST Compliance Platform.

Its primary objective is to simplify GST compliance for businesses and Chartered Accountants by reducing manual work involved in preparing and managing GST returns.

GSTPilot is NOT an accounting software.

GSTPilot is NOT an ERP.

GSTPilot is a Compliance Platform focused on GST workflows.

Future versions may expand into:

- Income Tax
- TDS
- Payroll
- e-Invoice
- e-Way Bill
- Business Compliance

---

# Problem Statement

Today, GST return preparation is still highly manual.

Users typically:

- Download reports from marketplaces or accounting software
- Clean Excel files manually
- Validate GST data
- Identify errors
- Correct invoices
- Generate JSON
- Upload returns

This process is:

- Time consuming
- Error prone
- Difficult for beginners
- Repetitive

GSTPilot aims to automate these steps while keeping users in control.

---

# Target Users

GSTPilot Version 1 targets three primary user groups.

## 1. Individual Business Owner

Examples:

- Shop Owners
- Freelancers
- Agencies
- Startups

Typical Needs:

- Manage GSTIN
- Upload invoices
- Generate GSTR-1
- View reports

---

## 2. Chartered Accountant (CA)

Typical Needs:

- Manage multiple clients
- Maintain GSTIN records
- Validate uploaded data
- Generate GST returns
- Download reports

---

## 3. Small Business

Typical Needs:

- Multiple GSTINs
- Invoice management
- Sales reporting
- Compliance tracking

---

# Product Goals

GSTPilot should:

- Reduce manual work
- Reduce GST filing errors
- Save time
- Improve reporting
- Provide AI assistance
- Maintain clean and modern UX

---

# Product Scope (Version 1)

Version 1 focuses on:

- Authentication
- Dashboard
- Client Management
- GSTIN Management
- Party Master
- Invoice Management
- Upload Center
- Validation Engine
- Compliance Engine
- JSON Generator
- Reports
- AI Assistant
- Billing
- Settings
- Admin Panel

Anything outside this scope belongs to future versions unless approved.

---

# Core Business Workflow

The primary workflow of GSTPilot is:

User Login

↓

Select Client

↓

Select GSTIN

↓

Upload Sales Data (Excel/CSV)

↓

Validate Data

↓

Review Errors

↓

Apply Corrections

↓

Generate GSTR-1 JSON

↓

Download JSON

↓

Upload to GST Portal

GSTPilot assists users throughout this process but does not directly file returns in Version 1.

---

# High-Level User Journey

1. User registers.
2. User logs in.
3. User creates or selects a client.
4. User adds one or more GSTINs.
5. User uploads invoice data.
6. System validates the uploaded data.
7. User reviews validation results.
8. User generates GST-compliant output.
9. User downloads reports and JSON.
10. User repeats the process for future return periods.

---

# Product Modules

## Authentication

Handles:

- Login
- Signup
- Password Reset
- Session Management

---

## Dashboard

Displays:

- Total Clients
- GSTIN Count
- Returns Generated
- Pending Work
- Recent Uploads
- Quick Actions

---

## Client Management

Stores business clients.

Each client may have:

- Multiple GSTINs
- Multiple invoices
- Multiple return periods

---

## GSTIN Management

Stores GST registration details.

Each GSTIN belongs to one client.

---

## Party Master

Stores customer and vendor information.

Purpose:

Avoid repeated manual entry.

Every invoice should reference a party.

---

## Invoice Management

Responsible for:

- Import
- Edit
- Delete
- Validation
- Search

Invoices are the primary business entity.

---

## Upload Center

Supports:

- Excel
- CSV

Future:

- PDF
- Image
- ZIP

---

## Validation Engine

Checks:

- GSTIN format
- Invoice numbers
- Duplicate invoices
- HSN codes
- Tax values
- State codes
- Mandatory fields

Validation does not modify data automatically.

---

## Compliance Engine

Responsible for applying GST business rules.

Responsibilities:

- Process validated data
- Prepare GSTR-1 structures
- Generate compliance-ready output

Future versions will support additional GST forms.

---

## JSON Generator

Converts processed data into GST-compatible JSON format.

Version 1 only supports download.

---

## Reports

Generate:

- Sales Reports
- GST Reports
- Error Reports
- Summary Reports
- JSON Export
- Excel Export

---

## AI Assistant

Version 1 responsibilities:

- Explain validation errors
- Explain GST concepts
- Assist with navigation
- Auto-map uploaded columns

AI never modifies data automatically.

---

## Billing

Handles:

- Subscription Plans
- Payments
- Invoices

---

## Settings

User preferences:

- Theme
- Profile
- Password
- Notification Preferences

---

## Admin Panel

Internal management only.

Responsibilities:

- Users
- Plans
- Subscriptions
- Analytics
- Support

---

# Data Ownership

Business hierarchy:

Workspace
└── Client
└── GSTIN
└── Party
└── Invoice
└── Return
└── Report

Every business record belongs to a workspace.

This design allows future expansion into team collaboration without changing the database structure.

---

# Product Philosophy

GSTPilot should always prioritize:

1. Simplicity
2. Accuracy
3. Performance
4. User Experience
5. Automation
6. Reusability

---

# Future Roadmap

Version 2

- OCR
- WhatsApp Notifications
- Email Reports
- Team Members
- Analytics
- Reconciliation

Version 3

- White Label
- ERP Integrations
- Approval Workflow
- Multi-Branch Support
- Public API

Future

- Income Tax
- TDS
- Payroll
- e-Way Bill
- AI Compliance Advisor

---

# Success Metrics

GSTPilot is considered successful when users can:

- Complete GST workflows faster than traditional methods
- Generate valid GSTR-1 JSON with minimal manual effort
- Understand and resolve validation issues easily
- Scale from individual use to managing multiple clients without architectural changes

---

# Important Notes for AI Coding Assistants

Before implementing any module:

- Read `00_PROJECT_CONSTITUTION.md`
- Read this document completely
- Understand the business workflow
- Follow existing terminology
- Never invent new business entities
- Never bypass documented workflows
- Ask for clarification if a requested feature conflicts with the documented product scope

---

End of Document
