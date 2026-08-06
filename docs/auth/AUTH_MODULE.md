# GSTPilot Authentication Module

Version: 1.0.0
Status: Active
Last Updated: August 2026

---

## Purpose

This module implements the complete authentication platform for GSTPilot using Better Auth, Prisma, and the Feature-Based Modular Monolith architecture.

It provides:

- Email/password registration and login
- Email verification
- Forgot password / reset password
- Session management (secure HttpOnly cookies)
- Route protection (middleware + server-side guards)
- Server Action protection
- Automatic workspace provisioning on registration
- RBAC foundation (Admin/User roles)
- Activity logging for all auth events

---

## Architecture

```
src/features/auth/
├── application/         # Use cases (getCurrentUser, getUserPermissions)
├── constants/           # Error messages, password requirements, activity actions
├── domain/              # Pure business rules (password strength validation)
├── infrastructure/      # Repository (DB operations) + Session service (guards)
├── presentation/        # UI components (forms, indicators, hooks)
├── schemas/             # Zod validation schemas
├── types/               # TypeScript type definitions
├── validation/          # Server-side validators
└── index.ts             # Public interface (single import point)
```

Supporting files:

- `src/lib/auth.ts` — Better Auth server configuration
- `src/lib/auth-client.ts` — Better Auth client configuration
- `middleware.ts` — Lightweight session cookie check for route protection

---

## Authentication Flows

### Registration

1. User submits name, email, password
2. Zod schema validates input (password complexity enforced)
3. Better Auth creates User + Account + Session
4. `databaseHooks.user.create.after` fires:
   - Creates Workspace
   - Links User → Workspace
   - Creates Profile
   - Creates Admin Role (if not exists)
   - Assigns Admin Role → User
   - Creates free trial Subscription
   - Logs activity
5. Verification email URL logged to console (dev) / sent via provider (prod)

### Login

1. User submits email + password
2. Better Auth validates credentials and creates session
3. Secure HttpOnly cookie is set
4. Client redirects to `callbackUrl` or `/dashboard`

### Logout

1. Client calls `authClient.signOut()`
2. Session destroyed server-side
3. Cookie cleared
4. Redirect to `/login`

### Forgot Password

1. User submits email
2. Better Auth generates reset token
3. Reset URL logged to console (dev) / sent via provider (prod)
4. UI always shows success (security: never reveal if email exists)

### Reset Password

1. User clicks reset link with token
2. Enters new password (complexity enforced)
3. Better Auth validates token and updates password
4. Redirect to login

### Email Verification

1. User clicks verification link with token
2. Better Auth validates token and sets `emailVerified = true`
3. User redirected to dashboard

---

## Route Protection

### Middleware (Lightweight)

The root `middleware.ts` performs an optimistic cookie check:

- **Public routes**: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/api/auth/*`
- **Auth routes** (redirect to dashboard if logged in): `/login`, `/register`, `/forgot-password`, `/reset-password`
- **Protected routes** (redirect to login if no cookie): everything else

### Server-Side Guards

For Server Components, Server Actions, and Route Handlers:

```typescript
import { requireSession, requirePermission } from "@/features/auth";

// Basic session check
const session = await requireSession();

// Session + workspace check
const { workspaceId } = await requireSessionWithWorkspace();

// Session + workspace + permission check
const session = await requirePermission("client.create");
```

---

## Password Policy

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

---

## RBAC Foundation

Version 1 supports two roles:

| Role  | Permissions                                                                    |
| ----- | ------------------------------------------------------------------------------ |
| Admin | All user permissions + `billing.manage` + `admin.access`                       |
| User  | Standard CRUD on clients, GSTIN, parties, invoices, uploads, reports, settings |

The permission engine checks **permissions, never roles** — new roles can be added without modifying business logic.

---

## Activity Logging

All auth events are logged to the `ActivityLog` table:

- `auth.register`
- `auth.login`
- `auth.logout`
- `auth.login_failed`
- `auth.password_reset_requested`
- `auth.password_reset_completed`
- `auth.email_verified`
- `auth.email_verification_sent`

---

## Dependencies

- `better-auth` — Authentication library
- `@hookform/resolvers` — Zod resolver for React Hook Form
- `react-hook-form` — Form state management
- `zod` — Schema validation
- `sonner` — Toast notifications
- `lucide-react` — Icons

---

## Future Scope

- Google / GitHub / Microsoft OAuth
- Passkeys (WebAuthn)
- Magic Links
- Multi-Factor Authentication (TOTP, Email OTP)
- Device session management
- Multi-workspace support
- Organization invites
- Remember Me
- Session dashboard

---

## Known Limitations

- Email delivery is console-only in development. A real email provider (Resend, Nodemailer) must be configured for production.
- Role assignment is hardcoded to "admin" for workspace creators. Future team invites will use the "user" role.
- Session-based role lookup defaults to "admin" — a DB lookup should be added when team members are supported.

---

End of Document
