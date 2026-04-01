# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
# Install frontend dependencies
cd frontend && npm install

# Run frontend dev server (port 5173, proxies /api/* to localhost:8000)
cd frontend && npm run dev

# Build frontend for production
cd frontend && npm run build

# Run backend dev server (port 8000)
cd api && uv run uvicorn api.index:app --reload --port 8000

# Install Python dependencies
cd api && uv sync

# Add a new Python dependency (then regenerate for Vercel)
cd api && uv add <package>
cd api && uv export --no-hashes --no-dev -o requirements.txt

# Run database migration (only needed if DATABASE_URL is configured)
DATABASE_URL=postgresql+asyncpg://... cd api && uv run alembic -c ../alembic/alembic.ini upgrade head

# Create a new migration after model changes
DATABASE_URL=postgresql+asyncpg://... cd api && uv run alembic -c ../alembic/alembic.ini revision --autogenerate -m "description"
```

There are no test scripts configured.

## Architecture

A serverless Vercel app that converts proxy subscriptions into sing-box configs.

**Frontend**: Vue 3 SPA (Vite + TypeScript) — built to `dist/`, served by Vercel as static files.
**Backend**: Python FastAPI in `api/index.py` — deployed as a single Vercel serverless function via Mangum (ASGI → Lambda adapter).
**Database**: Optional. Neon PostgreSQL (serverless Postgres) via SQLAlchemy async + asyncpg. Required only for saving configs server-side. The app starts and the generate endpoints work without it.
**Routing**: `vercel.json` rewrites all `/api/*` to `api/index.py`; Vite dev proxy does the same locally.

### Project structure

```
api/
  index.py          FastAPI app + Mangum handler (entry point)
  database.py       Async SQLAlchemy engine, session factory, Base — optional DB init
  models.py         ORM: Config model (id, name, data JSONB, timestamps)
  schemas.py        Pydantic v2 models for request/response and config doc structure
  pyproject.toml    Python dependency declaration (uv)
  uv.lock           Locked dependency versions
  requirements.txt  Pinned deps exported for Vercel (generated — do not edit manually)
  routers/
    configs.py      CRUD: GET/POST /api/configs, GET/PUT/DELETE /api/configs/{id} (requires DB)
    generate.py     Three generate endpoints — see Generate endpoints below

alembic/
  alembic.ini       Alembic configuration (script_location = %(here)s)
  env.py            Migration environment (strips +asyncpg → +psycopg for sync runs)
  versions/         Migration scripts

frontend/
  src/
    main.ts           Vue app entry, Element Plus (all icons globally registered), Pinia setup
    App.vue           Top-level layout (header + page switching)
    types/index.ts    TypeScript interfaces + Zod schemas (mirrors Pydantic schemas)
    stores/configs.ts Pinia store for config CRUD + generate helpers
    pages/
      ConfigListPage.vue    Table of all configs + create/delete
      ConfigEditorPage.vue  Four-tab editor: Subscriptions, Filters, Template, Generate
    components/
      SubscriptionsPanel.vue  Manage subscriber.subscriptions dict
      FiltersPanel.vue        Manage subscriber.filters array with include/exclude rules
      TemplatePanel.vue       URL or inline JSON template (Monaco Editor)
      MonacoEditor.vue        Monaco editor with sing-box JSON schema validation
    schemas/sing-box.schema.json  JSON schema for template editor validation
```

### Config document structure

Each config follows this shape (see `example.json`):

```json
{
  "subscriber": {
    "subscriptions": {
      "sub_name": {
        "url": "https://...",
        "enabled": true,
        "user_agent": "clashmeta"
      }
    },
    "filters": [
      {
        "tag": "output_tag",
        "type": "selector | urltest",
        "include": {
          "pattern": "HK",
          "proxy_type": ["vmess"],
          "regex": false,
          "match_case": false,
          "match_whole_word": false
        },
        "exclude": null,
        "subscriptions": ["sub_name"]
      }
    ]
  },
  "config_template": "https://... or inline JSON object"
}
```

### Database schema

Single table, one row per config profile:

```sql
configs(id UUID PK, name VARCHAR, data JSONB, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
```

No proxy caching — proxies are fetched live from subscription URLs on every generate request.

### Generate endpoints

All three share `_run_generate(config: ConfigData)` in `api/routers/generate.py`:

| Endpoint | DB required | Description |
|---|---|---|
| `POST /api/generate` | No | Body is `ConfigData` JSON — generate and return directly |
| `GET /api/generate?url=<url>` | No | Fetch `ConfigData` from a URL (Gist, S3, etc.), generate and return |
| `GET /api/configs/{id}/generate` | Yes | Load `ConfigData` from DB by ID, generate and return |

Generate flow (shared):
1. Fetch all enabled subscription URLs concurrently (`asyncio.gather`)
2. Load the template (from URL or inline dict)
3. For each filter: collect proxies from scoped subscriptions, apply include/exclude rules, create an outbound group
4. Prepend generated outbound groups to the template's `outbounds` array
5. Return the merged sing-box config as JSON

### Stateless workflow (no DB)

Users can run this app without a database. The recommended flow:
1. Build config in the UI editor (Subscriptions, Filters, Template tabs)
2. Go to the **Generate** tab → **Export Config JSON** to download `proxy-subscribe-config.json`
3. Upload that file to GitHub Gist or S3 and copy the raw URL
4. Paste the URL in the **Stateless Generate URL** section → copy the resulting `?url=` link
5. Use that link as a remote profile in sing-box — no account or server state needed

### Development notes

- Two processes required for local dev: `uvicorn` (port 8000) + `vite` (port 5173)
- `DATABASE_URL` is optional — omit it entirely to run without a database. CRUD endpoints return 503; generate endpoints work normally.
- When `DATABASE_URL` is set, it must use `+asyncpg` driver. Alembic's `env.py` automatically swaps to `+psycopg` for sync migration runs.
- `vite-plugin-monaco-editor` is a CJS package — `vite.config.ts` uses a `.default ??` fallback for ESM interop.
- Vercel Hobby plan caps serverless functions at 10s — Pro plan needed for slow subscription fetches (`maxDuration: 60`)
- `mangum` adapter: `lifespan="off"` because serverless has no persistent process lifecycle
