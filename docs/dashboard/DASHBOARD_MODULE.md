# GSTPilot Dashboard Module Documentation

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## 📌 Overview

The **Dashboard Module** serves as the central command center for GSTPilot. It provides a responsive layout foundation featuring top navigation (workspace switcher, command search, dynamic breadcrumbs, notification popover, quick action menu, theme toggle, user profile menu), collapsible sidebar navigation, statistics KPI cards, workspace activity timeline, loading/error states, and 8 feature-specific module widgets.

---

## 🏛️ Architecture & Component Design

The module follows GSTPilot's **Feature-Based Modular Monolith** architecture:

```
src/
├── app/(dashboard)/
│   ├── layout.tsx                   # Applies DashboardShell
│   └── dashboard/
│       ├── page.tsx                 # Server Component rendering DashboardView
│       ├── loading.tsx              # Renders DashboardSkeleton
│       └── error.tsx                # Route-level Error Boundary
├── components/layout/
│   ├── app-sidebar.tsx              # Collapsible sidebar with navigation groups
│   ├── app-topbar.tsx               # Topbar with breadcrumbs, search, actions, theme
│   ├── breadcrumbs.tsx              # Dynamic breadcrumb trail
│   ├── dashboard-shell.tsx          # Shell layout wrapper
│   ├── notification-dropdown.tsx    # Notification bell & popover
│   ├── quick-actions-menu.tsx       # Topbar quick actions dropdown
│   ├── search-dialog.tsx            # Cmd+K search dialog
│   ├── user-menu.tsx                # User profile & sign out dropdown
│   └── workspace-switcher.tsx       # Workspace context switcher
└── features/dashboard/
    ├── constants/                   # Stats initializers, activity logs
    ├── presentation/
    │   ├── activity-timeline.tsx    # Workspace activity feed
    │   ├── dashboard-skeleton.tsx   # Loading skeleton
    │   ├── dashboard-view.tsx       # Main composite view
    │   ├── quick-actions.tsx        # Hero quick actions panel
    │   ├── stats-cards.tsx          # KPI cards
    │   └── widgets/                 # 8 Module Overview Widgets
    │       ├── ai-widget.tsx
    │       ├── billing-widget.tsx
    │       ├── clients-widget.tsx
    │       ├── gstin-widget.tsx
    │       ├── invoices-widget.tsx
    │       ├── parties-widget.tsx
    │       ├── reports-widget.tsx
    │       └── uploads-widget.tsx
    ├── types/                       # StatMetric, ActivityLogItem, etc.
    └── index.ts                     # Public Feature API
```

---

## 🧩 Key Features & Components

### 1. Navigation & Layout Shell

- **AppSidebar**: Collapsible sidebar with icon mode support (`collapsible="icon"`), grouped navigation links (Overview, Compliance, Platform), workspace switcher, and user menu.
- **AppTopbar**: Responsive header containing:
  - Mobile sidebar trigger & breadcrumbs
  - Command Search modal trigger (`Cmd+K`)
  - Quick Action dropdown menu
  - Notification popover with unread count badge
  - Dark/Light Theme toggle
- **Breadcrumbs**: Automatically maps route segments to human-readable titles (`/dashboard/invoices` → Dashboard / Invoices).

### 2. Dashboard Command Center

- **Stats Cards**: Displays 4 key performance indicators (Total Clients, Active GSTINs, Monthly Sales Volume, Net Tax Liability) with trend direction indicators.
- **Quick Actions Panel**: Direct action buttons for high-frequency operations (Create Invoice, Add Client, Upload Data, Ask AI).
- **8 Module Placeholder Widgets**:
  - `ClientsWidget`: Client counts & verification state.
  - `GstinWidget`: Registered GSTIN status.
  - `PartiesWidget`: Customer vs Supplier breakdown.
  - `InvoicesWidget`: GSTR-1 draft readiness & tax invoice totals.
  - `UploadsWidget`: Ingestion processing status.
  - `ReportsWidget`: Return JSON export readiness.
  - `AiWidget`: AI Copilot audit score & recommendations.
  - `BillingWidget`: Plan tier, trial countdown, AI query credit usage.
- **Activity Timeline**: Chronological event feed with category icons, status badges (`completed`, `pending`, `failed`), timestamps, and empty state fallback.

### 3. Feedback States

- **Loading State**: `DashboardSkeleton` mirrors the exact card, grid, and timeline layout with animated Skeleton primitives.
- **Error State**: Route `error.tsx` provides a user-friendly error card with a retry handler.
- **Empty State**: Integrated `EmptyState` component used when activity feeds or data metrics are empty.

---

## 🔒 Verification & Compliance

The Dashboard module meets all project standards:

- **TypeScript**: Strict compilation with 0 errors.
- **Unit Tests**: Full test coverage for views, widgets, and navigation components.
- **Accessibility**: Keyboard navigable (Cmd+K search, dropdown focus traps), semantic ARIA attributes.
- **Responsive Design**: Mobile collapsible sidebar drawer, flex topbar wrapping, grid layout break-points (`sm:grid-cols-2 lg:grid-cols-4`).

---

End of Document
