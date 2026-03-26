# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (also auto-generates Prisma client via postinstall)
pnpm install

# Run all packages in watch/dev mode concurrently
pnpm dev

# Build all packages
pnpm build

# Start production backend server
pnpm start

# Run a single package
pnpm --filter @psc/backend dev
pnpm --filter @psc/frontend dev
pnpm --filter @psc/common dev

# Database operations (after schema changes)
pnpm --filter @psc/database exec prisma migrate dev
pnpm --filter @psc/database exec prisma generate
pnpm --filter @psc/database run prisma:studio
```

There are no test scripts configured.

## Architecture

This is a pnpm monorepo (`pnpm-workspace.yaml`) with four packages that together manage and convert proxy subscriptions into output configs (e.g. sing-box JSON).

### Package dependency graph

```
@psc/frontend  ──┐
                 ├──▶  @psc/common  (Zod schemas + TypeScript types)
@psc/backend  ───┤
                 └──▶  @psc/database  (Prisma client, SQLite)
```

### `@psc/common` — shared contracts

Built with `tsup` (dual ESM+CJS output). Exports Zod schemas and inferred TypeScript types for the three core domain models: `Subscription`, `Filter`, `Generator`. Both backend and frontend import from here — this is the single source of truth for API contracts.

### `@psc/database` — data layer

Prisma schema at `packages/database/prisma/schema.prisma`. Uses SQLite (`prisma/dev.db`) with the `better-sqlite3` driver adapter. The generated client is output to `packages/database/generated/prisma/` (not the default location). Key models:

- **Subscription** — a proxy subscription URL with traffic/expiry metadata and a list of **Proxy** records (each proxy has a `type` string and a `raw` JSON field)
- **Filter** — a named selector that picks proxies by subscription, proxy type (include/exclude list), and include/exclude regex patterns
- **Generator** — a config template (either inline JSON or a URL to fetch) plus a list of Filters; `generate` merges filtered proxies into the template's `outbounds` array

### `@psc/backend` — Express 5 API server

Entry point: `packages/backend/src/index.ts`. Runs on port 3000 and serves the built frontend from `../frontend/dist`.

Uses **tsyringe** for dependency injection (`reflect-metadata` must be imported first). `registry.ts` registers the `PrismaClient` singleton using the `@registry` decorator. Controllers and services use `@singleton()` and constructor injection.

Layer structure:
- `controllers/` — Express routers, resolve services from the DI container
- `services/` — business logic (`SubscriptionService`, `FilterService`, `GeneratorService`, `FileService`)
- `errors/KnownError.ts` — domain errors that produce HTTP 400 (vs. 500 for unexpected errors)

API routes:
- `GET/POST/PUT/DELETE /api/subscription[/:id]`
- `GET/POST/PUT/DELETE /api/filter[/:id]`
- `GET/POST/PUT/DELETE /api/generator[/:id]`, `GET /api/generator/generate/:id`

The `generate` endpoint in `GeneratorService` loads the template, resolves the associated filters, collects proxies from the relevant subscriptions, applies type/regex filtering, then injects the resulting proxy list as outbound entries.

Parsed subscription data (raw proxy objects) is stored in `packages/backend/src/subscriptions/` as JSON files (UUID-named), managed by `FileService`.

**Dev build**: `tsc-watch` compiles TypeScript then immediately runs `node dist/index.js` on success — there is no separate nodemon step.

### `@psc/frontend` — Vue 3 SPA

Vite + Vue 3 + Element Plus + Pinia + Monaco Editor. Pinia stores in `src/stores.ts` wrap axios calls to the backend API and validate responses against `@psc/common` Zod schemas. Pages: `SubscriptionPage`, `FilterManagementPage`, `GeneratorPage`, `MainPage`.

The `MonacoEditor` component uses the `packages/frontend/src/schemas/sing-box.schema.json` for JSON schema validation in the editor.
