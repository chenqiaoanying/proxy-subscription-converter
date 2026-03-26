# proxy-subscribe-converter

A monorepo for managing and converting proxy subscriptions.

## Packages

| Package | Description |
|---------|-------------|
| `@psc/common` | Shared Zod schemas and TypeScript types |
| `@psc/database` | Prisma client and SQLite database schema |
| `@psc/backend` | Express 5 API server |
| `@psc/frontend` | Vue 3 frontend |

## Prerequisites

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Generate Prisma client

The Prisma client is generated automatically via the `postinstall` hook in `@psc/database` when you run `pnpm install`. No manual step needed.

To regenerate manually (e.g. after schema changes):

```bash
pnpm --filter @psc/database exec prisma generate
```

### 3. Run database migrations (first time or after schema changes)

```bash
pnpm --filter @psc/database exec prisma migrate dev
```

## Development

Start all packages in watch mode concurrently:

```bash
pnpm dev
```

This runs:
- `@psc/common` — TypeScript build in watch mode
- `@psc/frontend` — Vite dev server
- `@psc/backend` — nodemon + tsc-watch server

## Production

```bash
pnpm build   # build all packages
pnpm start   # start the backend server
```