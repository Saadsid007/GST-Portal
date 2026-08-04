# GSTPilot

Production-grade AI-powered GST Compliance Platform foundation.

This repository contains the **platform bootstrap** — architecture, tooling, UI shell, authentication foundation, and feature scaffolds. Business features are implemented incrementally on top of this base.

## Tech stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Better Auth
- **UI:** Tailwind CSS, shadcn/ui, Radix UI, Lucide
- **State:** Zustand
- **Validation:** Zod
- **Testing:** Vitest, Playwright, Testing Library, MSW
- **Logging:** Pino

## Prerequisites

- Node.js 20+
- pnpm 11+
- PostgreSQL 16+ (local or Docker)

## Quick start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in required values:

- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — at least 32 characters (`openssl rand -base64 32`)
- `BETTER_AUTH_URL` — e.g. `http://localhost:3000`
- `NEXT_PUBLIC_APP_URL` — e.g. `http://localhost:3000`

### 3. Start PostgreSQL (Docker)

```bash
docker compose up -d
```

### 4. Initialize database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Run development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command              | Description                 |
| -------------------- | --------------------------- |
| `pnpm dev`           | Start Next.js dev server    |
| `pnpm build`         | Production build            |
| `pnpm start`         | Start production server     |
| `pnpm typecheck`     | TypeScript check            |
| `pnpm lint`          | ESLint                      |
| `pnpm lint:fix`      | ESLint with auto-fix        |
| `pnpm format`        | Prettier write              |
| `pnpm format:check`  | Prettier check              |
| `pnpm test`          | Vitest unit tests           |
| `pnpm test:watch`    | Vitest watch mode           |
| `pnpm test:coverage` | Coverage report             |
| `pnpm test:e2e`      | Playwright E2E tests        |
| `pnpm db:generate`   | Generate Prisma client      |
| `pnpm db:migrate`    | Create/apply migrations     |
| `pnpm db:deploy`     | Deploy migrations (CI/prod) |
| `pnpm db:studio`     | Prisma Studio               |
| `pnpm db:seed`       | Seed database               |

## Database

GSTPilot uses **PostgreSQL** with **Prisma ORM**. The database layer provides:

- **24 Prisma models** with workspace isolation, audit fields, and soft delete
- **Better Auth** integration (User, Session, Account, Verification)
- **RBAC** foundation (Role, Permission, RolePermission, UserRole)
- **Database utilities** at `src/lib/database/`

### Schema overview

```
Workspace
├── User / Profile / Session
├── Client → GSTIN → Party → Invoice → InvoiceItem
├── GstReturn → Report
├── Upload / ActivityLog / Notification
├── Subscription / ApiKey
└── AiConversation / AiUsage
```

### Database commands

| Command            | Description                                       |
| ------------------ | ------------------------------------------------- |
| `pnpm db:generate` | Generate Prisma client to `src/generated/prisma`  |
| `pnpm db:migrate`  | Create and apply migrations (requires PostgreSQL) |
| `pnpm db:deploy`   | Deploy migrations in CI/production                |
| `pnpm db:seed`     | Seed permissions and system roles (dev only)      |
| `pnpm db:studio`   | Open Prisma Studio                                |

### Database utilities

Import from `@/lib/database`:

- `runInTransaction` — atomic multi-table writes
- `BaseRepository` — workspace scope, audit, soft delete helpers
- `withCreateAudit` / `withUpdateAudit` — audit field stamping
- `withSoftDelete` / `withRestore` — soft delete operations
- `databaseService.healthCheck()` — connectivity check

See `docs/05_DATABASE_DESIGN.md` for full database architecture.

## Architecture

GSTPilot follows a **Feature-Based Modular Monolith**:

```
src/
├── app/           # Routing only (layouts, pages, API routes)
├── features/      # Business modules (auth, clients, gstin, …)
├── components/    # Shared UI (layout, feedback, shadcn/ui)
├── config/        # App configuration
├── lib/           # Core libraries (env, auth, prisma, logger)
├── services/      # Global service abstractions
├── hooks/         # Shared hooks
├── styles/        # Global styles & design tokens
└── types/         # Shared TypeScript types
```

Every feature owns:

- `application/` — use cases
- `domain/` — business rules
- `infrastructure/` — Prisma, repositories, integrations
- `presentation/` — UI components & hooks
- `validation/` — Zod schemas
- `api/` — feature API handlers

See `docs/` for full architecture documentation.

## Authentication

Better Auth is configured at `/api/auth/[...all]`. Login/register UI is intentionally **not** implemented in the bootstrap — the auth feature module is the first business feature to build.

Middleware performs optimistic session cookie checks; protected routes must still validate sessions server-side.

## Development workflow

1. Read relevant docs in `docs/` before coding
2. Implement inside the owning feature module
3. Run `pnpm typecheck && pnpm lint && pnpm test`
4. Update documentation for the feature

## Documentation

| Document                          | Purpose                                    |
| --------------------------------- | ------------------------------------------ |
| `docs/00_PROJECT_CONSTITUTION.md` | Project principles                         |
| `docs/05_DATABASE_DESIGN.md`      | Database architecture & schema conventions |
| `docs/02_PROJECT_ARCHITECTURE.md` | System architecture                        |
| `docs/03_FOLDER_STRUCTURE.md`     | Folder conventions                         |
| `docs/10_AUTH_SYSTEM.md`          | Authentication design                      |
| `docs/12_TESTING_STRATEGY.md`     | Testing standards                          |

## License

Private — GSTPilot
