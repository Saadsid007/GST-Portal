# 🚀 GSTPilot — Complete Technical & Functional Documentation

**Project Name:** GSTPilot  
**Version:** v1.0.0 (Production Ready)  
**Architecture:** Feature-Based Modular Monolith  
**Tech Stack:** Next.js (App Router, Turbopack), TypeScript (Strict), PostgreSQL, Prisma ORM, Better Auth, TailwindCSS, shadcn/ui, Zustand, Zod.

---

## 📑 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Design & Prisma Schema](#4-database-design--prisma-schema)
5. [Feature Modules Deep-Dive](#5-feature-modules-deep-dive)
   - [5.1 Authentication & Workspace Provisioning (`auth`)](#51-authentication--workspace-provisioning-auth)
   - [5.2 Dashboard & Financial KPI Engine (`dashboard`)](#52-dashboard--financial-kpi-engine-dashboard)
   - [5.3 Multi-Client Management (`clients`)](#53-multi-client-management-clients)
   - [5.4 GSTIN Registration & Profile Engine (`gstin`)](#54-gstin-registration--profile-engine-gstin)
   - [5.5 Customer & Supplier Party Registry (`party`)](#55-customer--supplier-party-registry-party)
   - [5.6 Invoicing Engine (`invoices`)](#56-invoicing-engine-invoices)
   - [5.7 File Upload & Excel/CSV Ingestion Engine (`uploads`)](#57-file-upload--excelcsv-ingestion-engine-uploads)
   - [5.8 GST Validation & Rule Engine (`validation`)](#58-gst-validation--rule-engine-validation)
   - [5.9 Compliance Engine & GSTR-1 JSON Generator (`compliance`)](#59-compliance-engine--gstr-1-json-generator-compliance)
   - [5.10 Advanced Reporting & Export Engine (`reports`)](#510-advanced-reporting--export-engine-reports)
   - [5.11 Settings & Workspace Administration (`settings`)](#511-settings--workspace-administration-settings)
   - [5.12 Billing & Usage Limit Enforcement (`billing`)](#512-billing--usage-limit-enforcement-billing)
   - [5.13 Platform Admin Panel (`admin`)](#513-platform-admin-panel-admin)
   - [5.14 AI Assistant Engine (`ai`)](#514-ai-assistant-engine-ai)
6. [Security & RBAC Architecture](#6-security--rbac-architecture)
7. [Environment Variables & Configuration](#7-environment-variables--configuration)
8. [Setup & Developer Walkthrough](#8-setup--developer-walkthrough)
9. [Verification & Testing Summary](#9-verification--testing-summary)

---

## 1. Executive Summary

**GSTPilot** is an enterprise-grade, multi-tenant AI-powered **GST Compliance Platform** built for Indian Businesses, Chartered Accountants (CA Firms), and Enterprises.

### Core Value Proposition

- **End-to-End Compliance:** Automates the complete flow from raw invoice ingestion (Excel/CSV upload) to automated rule validation, GST classification, and final **GSTR-1 JSON Generation** for official GST Portal offline filing.
- **Support for All Document Categories:** Fully supports B2B, B2CL, B2CS, Export, SEZ, Credit Notes (Sales Returns), and Debit Notes.
- **Enterprise Isolation & Multi-Tenancy:** Strict workspace-level data segregation powered by database row-level isolation and RBAC.

---

## 2. Technology Stack

| Layer                | Technology                                  |
| -------------------- | ------------------------------------------- |
| **Framework**        | Next.js 16 (App Router + Turbopack)         |
| **Language**         | TypeScript (Strict Mode)                    |
| **Database**         | PostgreSQL (v14+)                           |
| **ORM**              | Prisma ORM                                  |
| **Authentication**   | Better Auth + Custom Database Hooks         |
| **Styling**          | TailwindCSS + Vanilla CSS utilities         |
| **UI Components**    | shadcn/ui + Radix Primitives + Lucide Icons |
| **State Management** | Zustand                                     |
| **Validation**       | Zod (Runtime Schema Validation)             |
| **Form Handling**    | React Hook Form + @hookform/resolvers       |
| **Charts & Metrics** | Recharts                                    |
| **Excel Ingestion**  | XLSX (`sheetjs`)                            |
| **Testing**          | Vitest + Playwright                         |
| **Logging**          | Pino Logger                                 |

---

## 3. System Architecture

GSTPilot is engineered as a **Feature-Based Modular Monolith**. Each domain feature resides in `src/features/<feature_name>` and contains its own self-contained layers:

```text
src/features/<feature>/
├── application/     # Service orchestration (business logic & security guards)
├── domain/          # Pure functions, domain calculations, policies (zero side-effects)
├── infrastructure/  # Prisma repositories & external integrations
├── presentation/    # React Client & Server Components
├── server-actions/ # Next.js Server Actions with Zod & Session checks
├── schemas/         # Zod input/output validation schemas
├── types/           # TypeScript interfaces & types
└── constants/       # Enums and configuration constants
```

---

## 4. Database Design & Prisma Schema

The PostgreSQL database enforces strict foreign keys, UTC timestamps, soft-deletions, audit fields (`createdBy`, `updatedBy`), and multi-tenant `workspaceId` indexing across all business tables.

### Key Database Entities (24 Tables)

1. `workspace`: Core multi-tenant container for all business data.
2. `user` & `session`: Better Auth user accounts and active sessions.
3. `role`, `permission`, `role_permission`, `user_role`: Granular RBAC matrix.
4. `client`: Business entities managed inside a workspace.
5. `gstin`: 15-digit GSTIN registrations linked to clients.
6. `party`: Buyers, sellers, customers, and suppliers registry.
7. `invoice` & `invoice_item`: Line-item level tax documents (B2B, B2CL, B2CS, Credit Notes).
8. `upload`: File ingestion metadata with SHA-256 duplicate detection.
9. `validation_run` & `validation_issue`: Compliance validation findings.
10. `gst_return`: Compliance Engine output records storing GSTR-1 structures and JSON payloads.
11. `report`: Exported reports audit records.
12. `subscription`: Billing plan limits and active subscription metrics.
13. `activity_log`: Immutable system audit trail.

---

## 5. Feature Modules Deep-Dive

### 5.1 Authentication & Workspace Provisioning (`auth`)

- Built on top of **Better Auth** with custom Prisma database adapters.
- **Atomic Workspace Provisioning:** On sign-up, a transaction automatically creates:
  1. Default `Workspace` (`"Name's Workspace"`)
  2. Links `User.workspaceId`
  3. Creates `Profile` record
  4. Assigns system `Admin` role via `UserRole`
  5. Initializes default `Subscription` (Free Trial)
  6. Records registration in `ActivityLog`
- Includes database fallback lookups in `requireSessionWithWorkspace()` for bulletproof session protection.

### 5.2 Dashboard & Financial KPI Engine (`dashboard`)

- High-impact analytics dashboard showing:
  - Total Monthly Taxable Amount & Net GST Liability
  - Sales Breakdown (B2B vs B2CL vs B2CS)
  - Active Invoice Counts & Validation Status Health Ratio
  - Recent Activities Timeline & Quick Action Shortcuts

### 5.3 Multi-Client Management (`clients`)

- Designed for CA Firms and Enterprise tax departments managing multiple client companies.
- Full CRUD operations with PAN validation, state code mapping, and client status lifecycle.

### 5.4 GSTIN Registration & Profile Engine (`gstin`)

- Stores 15-digit GSTIN registrations under clients (`e.g., 27AABCS1234A1Z5`).
- Validates GSTIN structure: 2-digit State Code + 10-digit PAN + 1-digit Entity Number + Z + Checksum.

### 5.5 Customer & Supplier Party Registry (`party`)

- Centralized party ledger (Buyers & Sellers).
- Classifies parties by `CUSTOMER`, `SUPPLIER`, or `BOTH`.
- Tracks credit limits, outstanding balances, and GSTIN details.

### 5.6 Invoicing Engine (`invoices`)

- Complete invoice management lifecycle (Draft → Validated → Filed).
- Full support for:
  - **B2B:** Business-to-Business invoices (Inter-state & Intra-state)
  - **B2CL:** Inter-state consumer sales (> ₹2.5 Lakhs)
  - **B2CS:** Small consumer sales (< ₹2.5 Lakhs)
  - **Credit Notes:** Sales Returns (linked to original invoice number & date)
  - **Debit Notes:** Price adjustments
- Automated Line-Item calculation:
  - `Intra-state`: CGST (Half rate) + SGST (Half rate)
  - `Inter-state`: IGST (Full rate)

### 5.7 File Upload & Excel/CSV Ingestion Engine (`uploads`)

- Ingests `.xlsx`, `.xls`, and `.csv` files.
- **SHA-256 Checksum Verification:** Prevents duplicate file uploads.
- Staging table parser normalizes raw headers into standard fields (`invoice_number`, `invoice_date`, `party_name`, `taxable_amount`, etc.).

### 5.8 GST Validation & Rule Engine (`validation`)

- Executes 14+ automated compliance checks on ingested records:
  - `VAL-001`: Mandatory Field Validation
  - `VAL-002`: GSTIN Format & Checksum Verification
  - `VAL-003`: Tax Math Accuracy Check (`Taxable * Rate = Tax Amount`)
  - `VAL-004`: State Code vs Place of Supply Integrity (Intra-state vs Inter-state)
  - `VAL-005`: Credit Note Original Invoice Reference Check
- Outputs severity levels (`ERROR`, `WARNING`, `INFO`).

### 5.9 Compliance Engine & GSTR-1 JSON Generator (`compliance`)

- The core business rule engine of GSTPilot.
- Converts validated database invoices into official **GSTN Offline Tool compliant GSTR-1 JSON format**.
- Aggregates data into official GSTR-1 tables:
  - **Table 4A/4B:** B2B Invoices
  - **Table 5:** B2CL (Large Consumer) Invoices
  - **Table 7:** B2CS (Small Consumer) Invoices
  - **Table 9B:** CDNR (Credit/Debit Notes Registered)
  - **Table 12:** HSN Summary of Outward Supplies
  - **Table 13:** Documents Issued Summary
- One-click JSON Payload download for direct upload to `gst.gov.in`.

### 5.10 Advanced Reporting & Export Engine (`reports`)

- Comprehensive presentation layer:
  - **Sales Summary Report**
  - **Invoice Register Report**
  - **Party Summary Report**
  - **GST Tax Liability Summary**
  - **HSN Summary Report**
  - **Upload & Validation Audit Reports**
- Supports instant Excel & CSV data exports.

### 5.11 Settings & Workspace Administration (`settings`)

- User Profile Management (Name, Email, Password, Security).
- Workspace Details & General Configuration settings.

### 5.12 Billing & Usage Limit Enforcement (`billing`)

- Enforces subscription tiers: `FREE_TRIAL`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`.
- Tracks and limits GSTIN counts, Client counts, AI credits, and Storage space.

### 5.13 Platform Admin Panel (`admin`)

- Platform-wide telemetry for system operators:
  - User and Workspace counts
  - Database status & active transactions
  - System logs and audit activity

### 5.14 AI Assistant Engine (`ai`)

- Integrated AI assistant powered by Gemini API.
- Answers GST compliance questions, analyzes tax discrepancies, and provides natural language guidance.

---

## 6. Security & RBAC Architecture

GSTPilot implements a **Permission-Based RBAC System** (Role-Based Access Control).

- **27 Granular System Permissions:**
  - `workspace.read`, `workspace.update`
  - `client.create`, `client.read`, `client.update`, `client.delete`
  - `gstin.create`, `gstin.read`, `gstin.update`, `gstin.delete`
  - `party.create`, `party.read`, `party.update`, `party.delete`
  - `invoice.create`, `invoice.read`, `invoice.update`, `invoice.delete`
  - `return.generate`, `return.read`
  - `report.generate`, `report.export`
  - `upload.create`, `ai.use`, `billing.manage`, `user.invite`, `role.manage`
- Permissions are enforced on every Server Action and API Endpoint using `requirePermission("<code">)`.

---

## 7. Environment Variables & Configuration

Key configuration parameters in `.env`:

```env
# Node Environment
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# PostgreSQL Database Connection
DATABASE_URL="postgresql://hindsight:hindsight@localhost:5432/gstpilot?schema=public"

# Authentication
BETTER_AUTH_SECRET="local-dev-secret-minimum-32-characters-long"
BETTER_AUTH_URL="http://localhost:3000"

# Logging & AI
LOG_LEVEL="info"
AI_PROVIDER="gemini"
AI_API_KEY=""
```

---

## 8. Setup & Developer Walkthrough

### 1. Prerequisites

- Node.js (v20+)
- pnpm (v9+)
- PostgreSQL running locally (or via Docker)

### 2. Installation

```powershell
# Clone repository & install dependencies
pnpm install
```

### 3. Database Initialization

```powershell
# Push Prisma schema to PostgreSQL
pnpm prisma db push

# Seed system permissions and roles
pnpm db:seed
```

### 4. Seed Real Demo Dataset

```powershell
# Populates realistic client, GSTIN, parties, and 12 sales/credit note invoices
pnpm tsx --env-file=.env prisma/seed-demo.ts
```

### 5. Run Local Development Server

```powershell
pnpm dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 9. Verification & Testing Summary

- **Unit & Integration Tests:** 201/201 passed via `pnpm test`.
- **TypeScript Check:** Clean zero-error compilation via `pnpm typecheck`.
- **Production Build:** Verified clean build output via `pnpm build`.
- **Demo Flow Verification:**
  1. Open `/reports/gstr1`
  2. Select GSTIN `27AABCS1234A1Z5`
  3. Enter filing period `072025`
  4. Successfully generates and downloads official **GSTR-1 JSON**.

---

_Documentation created for GSTPilot Release v1.0.0._
