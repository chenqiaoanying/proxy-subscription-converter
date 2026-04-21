# Proxy Subscription Converter — Codemaps

**Last Updated:** 2026-04-20

High-level architecture maps of the project's main components.

## Overview

This is a serverless Vercel app that converts proxy subscriptions from sing-box JSON or
Clash/Mihomo YAML format into target sing-box or Clash configs. The system is built around
a unified internal proxy model to support cross-format conversion.

## Codemaps

1. **[Backend Architecture](./backend.md)** — FastAPI structure, database schema, routing
2. **[Format Support Layer](./formats.md)** — Unified proxy model, parsers, emitters, format detection
3. **[Frontend Architecture](./frontend.md)** — Vue 3 UI, state management, components
4. **[Database Schema](./database.md)** — Config storage, migrations, optional Neon Postgres

## Entry Points

| Layer | Path | Purpose |
|---|---|---|
| **API** | `backend/src/app/index.py` | FastAPI app root; route registration |
| **Web UI** | `frontend/src/main.ts` | Vue 3 app entry; store + router setup |
| **Formats** | `backend/src/app/formats/__init__.py` | Parser/emitter registries; central exports |
| **Migrations** | `backend/alembic/alembic.ini` | Alembic config; DB schema versioning |

## Key Concepts

### Unified Proxy Model

The app models proxies internally as a discriminated union (`Proxy` type in `formats/model.py`):
`ShadowsocksProxy`, `VmessProxy`, `VlessProxy`, `TrojanProxy`, `Hysteria2Proxy`, `TuicProxy`,
`WireguardProxy`, `HttpProxy`, `SocksProxy`, `UnknownProxy`. This allows format-agnostic
filtering, grouping, and region detection.

### Multi-Format Config Structure

User-facing `ConfigData` stores templates per target format as a tagged discriminated union:
```python
config_template: dict[Literal["sing-box", "clash"], TemplateSource | None]
```

where `TemplateSource = UrlTemplate | ObjectTemplate | InlineTemplate` (discriminated by `type` field).

Each template variant:
- **UrlTemplate** (`type: "url"`) — URL to a template file (fetched at generate time)
- **ObjectTemplate** (`type: "object"`) — Inline object (parsed and embedded directly)
- **InlineTemplate** (`type: "inline"`) — Raw YAML/JSON text (backend parses via YAML)

When generating, the app picks the right template, emits in the target format (JSON for
sing-box, YAML for Clash), and records any dropped proxies in the `X-Dropped-Proxies`
response header.

### Format Detection

Subscription sources are auto-detected via:
1. URL file extension (`.json` → sing-box, `.yaml|.yml` → Clash)
2. `Content-Type` header
3. Content sniffing (regex on opening bytes)

### Config Template Schema Versioning

Legacy configs with bare `config_template: "url" | {...}` are auto-migrated on load:
- `config_template: "url"` → `{type: "url", value: "url"}`
- `config_template: {...}` (no `type` field) → `{type: "object", value: {...}}`
- Tagged forms pass through unchanged

This happens via Pydantic `@model_validator(mode="before")` on backend and Zod
`z.preprocess` on frontend. Configs are persisted in the new tagged format after save.

## Data Flow: Generate Request

```
User → UI (Vue)
  ↓
POST /api/generate [ConfigData JSON]
  ↓
FastAPI endpoint (generate.py) receives format query param
  ↓
_run_generate(config, target):
  1. Fetch subscriptions (detect format, parse → Proxy[])
  2. Load template (fetch URL or use inline, pick target format key)
  3. Build groups (topological sort, filters, auto-region expansion)
  4. Use emitter to serialize (JSON for sing-box, YAML for Clash)
  ↓
Response (JSON|YAML, media_type, dropped_proxies header)
  ↓
User downloads or copies URL for remote use
```

## External Dependencies

| Layer | Package | Version | Purpose |
|---|---|---|---|
| **Backend** | `fastapi` | - | Web framework |
| **Backend** | `pydantic` | v2 | Request/response validation |
| **Backend** | `sqlalchemy` | async + asyncpg | ORM + async Postgres driver |
| **Backend** | `httpx` | - | Async HTTP (subscriptions, templates) |
| **Backend** | `pyyaml` | - | YAML parsing/emission (Clash format) |
| **Backend** | `alembic` | - | Database migrations |
| **Frontend** | `vue` | 3 | UI framework |
| **Frontend** | `pinia` | - | State management |
| **Frontend** | `element-plus` | - | Component library + icons |
| **Frontend** | `monaco-editor` | via vite plugin | Code editor (templates, JSON/YAML) |

## Related Docs

- **Format References**: `docs/sing-box-config.md`, `docs/metacubex-mihomo-config.md` —
  upstream format specifications (not maintained by this project)
