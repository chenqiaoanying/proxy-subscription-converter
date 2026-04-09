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
cd backend && uv run uvicorn api.index:app --reload --port 8000

# Install Python dependencies
cd backend && uv sync

# Add a new Python dependency (then regenerate for Vercel)
cd backend && uv add <package>
cd backend && uv export --no-hashes --no-dev -o api/requirements.txt

# Run database migration (only needed if DATABASE_URL is configured)
DATABASE_URL=postgresql+asyncpg://... cd backend && uv run alembic -c alembic/alembic.ini upgrade head

# Create a new migration after model changes
DATABASE_URL=postgresql+asyncpg://... cd backend && uv run alembic -c alembic/alembic.ini revision --autogenerate -m "description"
```

There are no test scripts configured.

## Architecture

A serverless Vercel app that converts proxy subscriptions into sing-box configs.

**Frontend**: Vue 3 SPA (Vite + TypeScript) — built to `dist/`, served by Vercel as static files.
**Backend**: Python FastAPI in `backend/api/index.py` — deployed as a single Vercel serverless function via Mangum (ASGI → Lambda adapter).
**Database**: Optional. Neon PostgreSQL (serverless Postgres) via SQLAlchemy async + asyncpg. Required only for saving configs server-side. The app starts and the generate endpoints work without it.
**Routing**: `vercel.json` rewrites all `/api/*` to `backend/api/index.py`; Vite dev proxy does the same locally.

### Project structure

```
backend/
  pyproject.toml    Python dependency declaration (uv)
  uv.lock           Locked dependency versions
  api/
    index.py          FastAPI app + Mangum handler (entry point)
    database.py       Async SQLAlchemy engine, session factory, Base — optional DB init
    models.py         ORM: Config model (id, name, data JSONB, timestamps)
    schemas.py        Pydantic v2 models for request/response and config doc structure
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
      ConfigEditorPage.vue  Four-tab editor: Subscriptions, Groups, Template, Generate
    components/
      SubscriptionsPanel.vue  Manage subscriber.subscriptions dict
      GroupsPanel.vue         Manage subscriber.groups array (static or auto_region groups)
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
    "groups": [
      {
        "tag": "HK Nodes",
        "type": "selector",
        "include": {
          "pattern": "HK",
          "proxy_type": ["vmess"],
          "regex": false,
          "match_case": false,
          "match_whole_word": false
        },
        "exclude": null,
        "imports": ["sub_name"]
      },
      {
        "group_tag": "My Proxies",
        "type": "auto_region",
        "group_type": "selector",
        "sub_group_tag": "{region} Nodes",
        "sub_group_type": "urltest",
        "imports": ["sub_name"],
        "regions": "auto",
        "others_tag": "Others",
        "region_map": {},
        "use_emoji": true,
        "include": null,
        "exclude": null
      }
    ]
  },
  "config_template": "https://... or inline JSON object"
}
```

**Group types:**

- **Static group** (`type: "selector" | "urltest"`): Manually-defined outbound group. Collects proxies from scoped subscriptions and applies include/exclude rules.
  - `tag: str` — name of the outbound group
  - `type: Literal["selector", "urltest"]` — sing-box outbound type
  - `include: MatchRule | null` — include filter (pattern, proxy_type, regex, match_case, match_whole_word)
  - `exclude: MatchRule | null` — exclude filter
  - `imports: list[str]` — subscription names or group tags to pull proxies from (empty = all subscriptions)

- **Auto-region group** (`type: "auto_region"`): Dynamically creates a parent outbound group containing one sub-group per detected region.
  - `group_tag: str` — name of the parent outbound group
  - `type: Literal["auto_region"]` — marks this as dynamic
  - `group_type: Literal["selector", "urltest"]` (default `"selector"`) — sing-box outbound type for the parent group
  - `sub_group_tag: str` — must contain `{region}` placeholder (e.g. `"{region} Nodes"`)
  - `sub_group_type: Literal["selector", "urltest"]` (default `"urltest"`) — sing-box outbound type for each region sub-group
  - `imports: list[str]` — subscription names or group tags to pull proxies from (empty = all subscriptions)
  - `regions: list[str] | "auto"` — region strategy:
    - `"auto"` — detect all regions dynamically from proxy keywords, sort by count, appends an `{others_tag}` group for unmatched proxies
    - `["HK", "JP", "US"]` — explicit ordered regions; appends an `{others_tag}` group for unmatched proxies
  - `others_tag: str` (default `"Others"`) — substituted into `{region}` placeholder for the catch-all sub-group
  - `region_map: dict[str, str]` — override keyword mappings (e.g. `{"香港": "HK"}`)
  - `use_emoji: bool` — prepend emoji flag to region label in sub-group tag (e.g. `🇭🇰 HK Nodes`)
  - `include: MatchRule | null` — include filter before region expansion
  - `exclude: MatchRule | null` — exclude filter before region expansion

Built-in region keyword map (22 regions): HK, TW, JP, KR, SG, US, GB, DE, FR, NL, CA, AU, IN, BR, RU, TR, AR, PH, ID, MY, TH, VN.

### Database schema

Single table, one row per config profile:

```sql
configs(id UUID PK, name VARCHAR, data JSONB, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
```

No proxy caching — proxies are fetched live from subscription URLs on every generate request.

### Generate endpoints

All three share `_run_generate(config: ConfigData)` in `backend/api/routers/generate.py`:

| Endpoint | DB required | Description |
|---|---|---|
| `POST /api/generate` | No | Body is `ConfigData` JSON — generate and return directly |
| `GET /api/generate?url=<url>` | No | Fetch `ConfigData` from a URL (Gist, S3, etc.), generate and return |
| `GET /api/configs/{id}/generate` | Yes | Load `ConfigData` from DB by ID, generate and return |

Generate flow (shared):
1. Fetch all enabled subscription URLs concurrently (`asyncio.gather`)
2. Load the template (from URL or inline dict)
3. For each group (in dependency order): resolve `imports` as subscription names or other group tags, apply include/exclude rules; if auto_region, expand into region sub-groups
4. Prepend generated outbound groups to the template's `outbounds` array
5. Return the merged sing-box config as JSON

### Stateless workflow (no DB)

Users can run this app without a database. The recommended flow:
1. Build config in the UI editor (Subscriptions, Groups, Template tabs)
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

## Rules

1. **Commit messages**: Use conventional commit format (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`). Keep the first line under 72 characters, imperative mood.

2. **Type annotations everywhere**: All Python function signatures must have type annotations. All TypeScript should use explicit types — avoid `any`. Pydantic models and Zod schemas are the canonical validators at system boundaries.

3. **Validate all external data**: Subscription URL responses, user input, and fetched config JSON must be validated through Pydantic (backend) or Zod (frontend) before use. Never trust external data.

4. **No hardcoded secrets or magic values**: Use environment variables for secrets (validated at startup). Extract magic numbers and strings into named constants or config.

5. **Error handling — never swallow silently**: Every `try/catch` (TS) and `try/except` (Python) must log or re-raise. FastAPI endpoints return meaningful HTTP status codes. Never expose stack traces to the client.

6. **Immutable API responses**: FastAPI endpoints should return Pydantic response models, not raw dicts. This ensures consistent response shapes and serialization.

7. **Async resource cleanup**: Use `async with` for database sessions and HTTP clients. Never leave connections unclosed — critical in the serverless context where each invocation is isolated.

8. **Vue reactivity discipline**: Use `computed` for derived state, `watch` sparingly. Keep component props readonly and emit events to communicate upward. Never directly mutate props.

9. **No `console.log` in committed code**: Remove debug logs before committing. Surface errors through Element Plus notifications or proper error boundaries.

10. **File size limits**: Keep files under 400 lines. Functions under 50 lines. Avoid nesting deeper than 4 levels.

11. **Dependency hygiene**: After `uv add <package>` (from `backend/`), always regenerate with `uv export --no-hashes --no-dev -o api/requirements.txt`. Never edit `uv.lock` or `requirements.txt` by hand.

12. **SQL safety**: Always use SQLAlchemy ORM methods or parameterized queries. Never interpolate user input into raw SQL strings.
