# GSTPilot UI Design System

Version: 1.0.0

Status: Active

Last Updated: July 2026

---

# Purpose

This document defines the complete UI Design System of GSTPilot.

Every page,
component,
dialog,
table,
form,
chart,
and layout

MUST follow this document.

No UI should be created without following these standards.

---

# Design Philosophy

GSTPilot is a Professional SaaS Platform.

The UI must feel

✓ Clean

✓ Modern

✓ Fast

✓ Minimal

✓ Professional

✓ Trustworthy

✓ Accessible

The inspiration comes from products like

- Stripe
- Linear
- Vercel
- Notion
- GitHub
- Clerk

Never imitate old ERP or desktop software.

---

# UI Stack

Framework

Next.js

Styling

Tailwind CSS

Component Foundation

shadcn/ui

Headless Components

Radix UI

Icons

Lucide React

Animation

Framer Motion

Fonts

Geist
Inter

Charts

Recharts

Tables

TanStack Table

Forms

React Hook Form

Validation

Zod

---

# Design Tokens

Never hardcode colors.

Use semantic tokens only.

Examples

Background

Foreground

Primary

Secondary

Accent

Muted

Border

Success

Warning

Danger

Info

Dark mode must use the same tokens.

---

# Border Radius

Small

Medium

Large

Extra Large

Use consistent radius across the application.

Never mix random rounded values.

---

# Spacing System

Use an 8px spacing scale.

4

8

12

16

24

32

40

48

64

96

Never use arbitrary spacing values.

---

# Typography

Headings

H1

H2

H3

H4

Body

Small

Caption

Code

Never manually change font sizes inline.

Use predefined typography classes.

---

# Color Philosophy

Primary

Brand actions

Secondary

Supporting actions

Success

Completed

Warning

Needs attention

Danger

Errors

Info

Neutral information

Never use color as the only indicator.

Always combine with icons or text.

---

# Theme Support

Supported

Light

Dark

System

Every component must support all themes.

---

# Layout

Application Layout

Sidebar

Top Navigation

Breadcrumb

Content Area

Footer (optional)

The layout must remain consistent across modules.

---

# Sidebar

Contains

Dashboard

Clients

GSTIN

Parties

Invoices

Uploads

Validation

Reports

AI Assistant

Billing

Settings

Sidebar should be collapsible.

---

# Top Navigation

Contains

Workspace

Search

Notifications

Theme Toggle

Profile Menu

Quick Actions

---

# Page Structure

Every page follows:

Header

↓

Toolbar

↓

Filters

↓

Content

↓

Pagination

↓

Footer Actions

---

# Cards

Use cards for

Statistics

Overview

Summary

Insights

Cards should have

Title

Description

Content

Optional Actions

---

# Forms

Every form includes

Title

Description

Validation

Helper Text

Submit

Cancel

Loading State

Error State

Success State

Never create inconsistent forms.

---

# Tables

Every data table supports

Search

Sorting

Filtering

Pagination

Column Visibility

Export

Row Selection

Sticky Header

Responsive Mode

---

# Dialogs

Standard dialogs

Confirmation

Delete

Edit

Preview

Success

Error

Never create custom dialog styles.

---

# Buttons

Variants

Primary

Secondary

Outline

Ghost

Link

Danger

Sizes

Small

Medium

Large

Icon

Loading

Disabled

Every button should support loading states.

---

# Inputs

Supported

Text

Number

Email

Password

Search

Textarea

Select

Checkbox

Radio

Switch

Date

File Upload

Every input supports validation.

---

# Toast Notifications

Types

Success

Error

Warning

Info

Position

Top Right

Never use browser alerts.

---

# Empty States

Every module must define an empty state.

Include

Illustration

Title

Description

Primary Action

---

# Loading States

Use

Skeletons

Progress Indicators

Shimmer Effects

Avoid full-screen loaders when possible.

---

# Error States

Every page should gracefully handle

Network Error

Permission Error

Validation Error

Unknown Error

Provide recovery actions.

---

# Icons

Use Lucide React only.

Never mix multiple icon libraries.

Icons should communicate meaning.

---

# Animations

Keep animations subtle.

Use

Fade

Slide

Scale

Duration

150–250ms

Avoid excessive motion.

---

# Accessibility

Every component must support

Keyboard Navigation

Focus States

ARIA Labels

Screen Readers

High Contrast

WCAG-friendly color contrast

Accessibility is mandatory.

---

# Responsive Design

Support

Mobile

Tablet

Desktop

Wide Screens

Never design desktop-first only.

---

# Design Tokens

Store all tokens centrally.

Never hardcode

Colors

Spacing

Radius

Shadows

Typography

Components must consume tokens instead of raw values. :contentReference[oaicite:1]{index=1}

---

# Component Rules

Wrap shadcn/ui components in GSTPilot components.

Never modify upstream components unnecessarily.

App-specific styling belongs in wrappers.

This keeps future updates manageable while preserving a consistent design system. :contentReference[oaicite:2]{index=2}

---

# Page Naming

Every page must include

Title

Description

Breadcrumb

Primary Action

Content

Never leave pages without context.

---

# Dashboard Rules

Cards at top

Charts in middle

Tables at bottom

Quick Actions always visible.

---

# Branding

Logo

GSTPilot

Primary Brand Color

Defined in theme tokens

Favicon

Light & Dark variants

---

# Micro-interactions

Buttons

Hover

Press

Focus

Loading

Success

Tables

Hover

Selected

Clickable

Forms

Focus

Validation

Success

---

# AI Coding Instructions

Before generating UI

Read

UI Design System

Never invent new spacing

Never invent new colors

Never invent new typography

Reuse existing components

Build responsive layouts

Prefer composition over duplication

---

End of Document
