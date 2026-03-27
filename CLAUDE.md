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

This is a pnpm monorepo (`pnpm-workspace.yaml`) that aggregates proxies from multiple sing-box subscription URLs, lets you define filters on them, and generates a ready-to-use sing-box config by merging filtered proxies into a template.

### Package dependency graph

```text
@psc/frontend  ──┐
                 ├──▶  @psc/common  (Zod schemas + TypeScript types)
@psc/backend  ───┤
                 └──▶  @psc/database  (Prisma client, SQLite)
```

### `@psc/common` — shared contracts

Built with `tsup` (dual ESM+CJS output). Exports Zod schemas and inferred TypeScript types for the three core domain models: `Subscription`, `Filter`, `Generator`. Both backend and frontend import from here — this is the single source of truth for API contracts.

### `@psc/database` — data layer

Prisma schema at `packages/database/prisma/schema.prisma`. Uses SQLite (`prisma/dev.db`) with the `better-sqlite3` driver adapter. The generated client is output to `packages/database/generated/prisma/` (not the default location). Key models:

- **Subscription** — a proxy subscription URL with optional traffic/expiry metadata and a list of **Proxy** records. Each `Proxy` has a `tag` string, a `type` string, and a `raw` JSON field holding the full sing-box outbound object.
- **Filter** — a named selector/urltest group that picks proxies by subscription, proxy type (include/exclude list), and include/exclude regex patterns on the proxy `tag`.
- **Generator** — a sing-box config template (either inline JSON or a URL to fetch) plus a list of Filters that become its outbound groups.

### `@psc/backend` — Express 5 API server

Entry point: `packages/backend/src/index.ts`. Runs on port 3000 and serves the built frontend from `../frontend/dist`.

Uses **tsyringe** for dependency injection (`reflect-metadata` must be imported first). `registry.ts` registers the `PrismaClient` singleton using the `@registry` decorator. Controllers and services use `@singleton()` and constructor injection.

Layer structure:

- `controllers/` — Express routers, resolve services from the DI container
- `services/` — business logic (`SubscriptionService`, `FilterService`, `GeneratorService`)
- `errors/KnownError.ts` — domain errors that produce HTTP 400 (vs. 500 for unexpected errors)

API routes:

- `GET/POST/PUT/DELETE /api/subscription[/:id]` — CRUD + optional `?refresh=true` to re-fetch proxies
- `GET/POST/PUT/DELETE /api/filter[/:id]`
- `GET/POST/PUT/DELETE /api/generator[/:id]`, `GET /api/generator/generate/:id`

**`FileService`** exists but is no longer used — all subscription/proxy data is persisted in SQLite. The `packages/backend/src/subscriptions/` directory contains leftover JSON files from a previous file-based storage approach.

**Dev build**: `tsc-watch` compiles TypeScript then immediately runs `node dist/index.js` on success.

#### Subscription ingestion flow

`SubscriptionService.loadProxyFromUrl` fetches a sing-box subscription URL (which returns JSON with an `outbounds` array), filters to only entries that have a `server` field (i.e. actual proxy outbounds, not groups), and stores them in the `Proxy` table with `tag`, `type`, and the full outbound object as `raw`. Traffic metadata is parsed from the `Subscription-Userinfo` response header.

#### Generation flow (`GET /api/generator/generate/:id`)

This endpoint IS the subscription URL for sing-box. It:

1. Loads the template — either the stored JSON or fetches from a URL
2. For each Filter: collects proxies from the relevant subscriptions, applies type-filter and include/exclude regex on `proxy.tag`, then produces a sing-box outbound group `{ tag, type, outbounds: [<proxy objects>] }`
3. Prepends the filter outbounds to the template's existing `outbounds` array and returns the merged config JSON

Each `Filter` maps directly to one sing-box `selector` or `urltest` outbound in the output.

### `@psc/frontend` — Vue 3 SPA

Vite + Vue 3 + Element Plus + Pinia + Monaco Editor. Pinia stores in `src/stores.ts` wrap axios calls to the backend API and validate responses against `@psc/common` Zod schemas. Pages: `SubscriptionPage`, `FilterManagementPage`, `GeneratorPage`, `MainPage`.

The `MonacoEditor` component uses `packages/frontend/src/schemas/sing-box.schema.json` for JSON schema validation when editing generator templates inline.
