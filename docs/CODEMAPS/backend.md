# Backend Architecture Codemap

**Last Updated:** 2026-04-20
**Entry Points:** `backend/src/app/index.py`

## Architecture

```
FastAPI App (index.py)
  ├──→ routers/configs.py (CRUD, requires DB)
  ├──→ routers/generate.py (Three generate endpoints, format-agnostic)
  │     └──→ formats/* (Parsers, emitters, unified proxy model)
  ├──→ schemas.py (Pydantic request/response models)
  ├──→ models.py (SQLAlchemy ORM: Config)
  └──→ database.py (Async SQLAlchemy engine, session factory)

alembic/
  ├──→ alembic.ini (Config)
  └──→ env.py (Auto-convert +asyncpg → +psycopg for migrations)
```

## Routers

### `routers/generate.py` — Generate Endpoints

**Purpose:** Convert proxy subscriptions into target configs (sing-box JSON or Clash YAML).

**Endpoints:**

| Endpoint | Method | DB | Query Params | Response |
|---|---|---|---|---|
| `/api/generate` | POST | No | `?format=sing-box\|clash` | JSON \| YAML |
| `/api/generate` | GET | No | `url=<url>&format=...` | JSON \| YAML |
| `/api/configs/{id}/generate` | GET | Yes | `?format=sing-box\|clash` | JSON \| YAML |

**Helper Endpoints:**
- `POST /api/subscriptions/preview` (no DB) — Preview proxies from a single subscription URL

**Key Functions:**

| Function | Purpose | Inputs | Output |
|---|---|---|---|
| `_run_generate` | Core logic: fetch subs, apply groups, emit target | ConfigData, target_format | GenerateResult (bytes, media_type, headers) |
| `_fetch_subscription` | Fetch a single subscription URL, auto-detect format | name, SubscriptionConfig | (name, Proxy[], userinfo_str) |
| `_apply_filter_rules` | Apply include/exclude rules to proxies | Proxy[], include_rule, exclude_rule | Proxy[] |
| `_detect_region` | Infer region from proxy name + keyword map | proxy_name, region_map | str \| None |
| `_build_groups` | Construct outbound groups (static & auto-region) | subscriptions, groups config, Proxy[] | list[ProxyGroup] |
| `_topological_sort` | Sort groups by dependency order | GroupConfig[] | int[] (indices) |
| `preview_subscription` | Return proxy names & types from a single URL | SubscriptionPreviewRequest | SubscriptionPreviewResponse |

**Constants:**

| Constant | Value |
|---|---|
| `REGION_KEYWORD_MAP` | 22 region codes (HK, TW, JP, …) → keywords (for auto-detection) |
| `REGION_EMOJI` | Region code → emoji flag (for UI labeling) |

**Group Resolution Logic:**
1. Parse static groups: `tag`, `type: "selector" | "urltest"`, `include/exclude`, `imports`
2. Parse auto-region groups: `group_tag`, `sub_group_tag: "{region}"`, `regions: "auto" | [...]`
3. Resolve `imports` → subscription names or other group tags
4. Apply topological sort to handle cross-group dependencies
5. For each group: filter proxies, expand regions if auto-region, create ProxyGroup objects

### `routers/configs.py` — CRUD Endpoints

**Purpose:** Store/retrieve configs (requires DATABASE_URL).

**Endpoints:**

| Method | Path | DB required | Purpose |
|---|---|---|---|
| `GET` | `/api/configs` | Yes | List all saved configs (paginated) |
| `POST` | `/api/configs` | Yes | Create a config |
| `GET` | `/api/configs/{id}` | Yes | Read a config |
| `PUT` | `/api/configs/{id}` | Yes | Update a config |
| `DELETE` | `/api/configs/{id}` | Yes | Delete a config |

**Key Functions:**

| Function | Purpose |
|---|---|
| `list_configs` | Query Config table, return metadata + timestamps |
| `create_config` | Insert new Config row, auto-generate UUID |
| `read_config` | Fetch Config by ID, deserialize data JSONB |
| `update_config` | Update Config name and/or data |
| `delete_config` | Delete Config by ID |

**Note:** If `DATABASE_URL` is not set, these endpoints return `503 Service Unavailable`.

## Data Models

### `schemas.py` — Request/Response Models

**Core Models:**

| Model | Purpose |
|---|---|
| `MatchRule` | Filter rule: `pattern`, `proxy_type[]`, `regex`, `match_case`, `match_whole_word` |
| `UrlTestOptions` | URL-test group settings: `url`, `interval`, `tolerance` |
| `StaticGroupConfig` | Static group: `tag`, `type`, `include/exclude`, `imports` |
| `AutoRegionGroupConfig` | Auto-region group: `group_tag`, `sub_group_tag`, `regions`, `use_emoji` |
| `GroupConfig` | Union: `AutoRegionGroupConfig \| StaticGroupConfig` |
| `SubscriptionConfig` | Single subscription: `url`, `enabled`, `user_agent` |
| `SubscriberConfig` | All subscriptions + groups: `subscriptions{}`, `groups[]` |
| `TargetFormat` | Type alias: `Literal["sing-box", "clash"]` |
| `ConfigData` | Full user config: `subscriber`, `config_template{}` |

**Legacy Support:**
- Bare `config_template: str \| dict \| None` auto-wrapped to `{"sing-box": value}` via
  `ConfigData._wrap_legacy_template()` Pydantic validator
- Existing saved configs continue to work

**CRUD Models:**

| Model | Purpose |
|---|---|
| `ConfigCreate` | `name`, `data: ConfigData` |
| `ConfigUpdate` | Optional `name`, optional `data: ConfigData` |
| `ConfigListItem` | Metadata: `id`, `name`, `created_at`, `updated_at` |
| `ConfigOut` | Full config: `id`, `name`, `data{}`, `created_at`, `updated_at` |

**Response Models:**

| Model | Purpose |
|---|---|
| `ProxyPreview` | `tag: str`, `type: str` (canonical, e.g., `ss` → `shadowsocks`) |
| `SubscriptionPreviewResponse` | `proxies: ProxyPreview[]`, `userinfo: SubscriptionUserInfo \| None` |
| `SubscriptionUserInfo` | Parsed subscription header: `upload`, `download`, `total`, `expire` |

### `models.py` — ORM

**Config Model:**

```python
class Config(Base):
    __tablename__ = "configs"
    
    id: UUID = PrimaryKey
    name: str = VARCHAR
    data: dict = JSONB (stores ConfigData serialized)
    created_at: datetime = TIMESTAMPTZ
    updated_at: datetime = TIMESTAMPTZ
```

## Database

### Schema

**configs table:**
```sql
CREATE TABLE configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Setup

1. Set `DATABASE_URL` environment variable: `postgresql+asyncpg://user:pass@host/db?sslmode=require`
2. Run migrations: `alembic upgrade head`

### Migrations

**Location:** `backend/alembic/`
- `alembic.ini` — Configuration (script_location, sqlalchemy.url from env)
- `env.py` — Runtime config (auto-swaps `+asyncpg` → `+psycopg` for sync runs)
- `versions/` — Migration scripts (auto-generated or manual)

**Creating a migration after model changes:**
```bash
DATABASE_URL=postgresql+asyncpg://... alembic revision --autogenerate -m "description"
```

**Running migrations:**
```bash
DATABASE_URL=postgresql+asyncpg://... alembic upgrade head
```

## API Request/Response Flow

### Generate from Body

```
POST /api/generate?format=clash
Content-Type: application/json

{
  "subscriber": {...},
  "config_template": {"sing-box": null, "clash": "https://..."}
}

↓ (parse JSON body as ConfigData)
↓ (call _run_generate(config, "clash"))
↓ (fetch subscriptions, detect format, emit as YAML)

200 OK
Content-Type: application/yaml
X-Dropped-Proxies: 0

proxies: [...]
proxy-groups: [...]
```

### Generate from URL

```
GET /api/generate?url=https://gist.raw/config.json&format=sing-box

↓ (fetch URL → parse body as ConfigData)
↓ (call _run_generate(config, "sing-box"))
↓ (emit as JSON)

200 OK
Content-Type: application/json

{
  "outbounds": [...]
}
```

### Load from DB and Generate

```
GET /api/configs/{id}/generate?format=clash

↓ (query DB for config_id)
↓ (deserialize data JSONB as ConfigData)
↓ (call _run_generate(config, "clash"))

200 OK
Content-Type: application/yaml
X-Dropped-Proxies: 1

proxies: [...]
```

## Error Handling

| Scenario | Status | Detail |
|---|---|---|
| Invalid config JSON | 422 | Pydantic validation error |
| Subscription fetch fails | 400 | "Failed to fetch subscription: ..." |
| Unsupported subscription format | 400 | "Unrecognised subscription format: ..." |
| Config not found | 404 | "Config not found" |
| DB not configured | 503 | "Service Unavailable" (on CRUD endpoints) |
| Template URL unreachable | 400 | "Failed to load template: ..." |

## Dependencies

| Package | Purpose |
|---|---|
| `fastapi` | Web framework |
| `pydantic` | Request/response validation (v2) |
| `sqlalchemy` | Async ORM |
| `asyncpg` | Async Postgres driver |
| `httpx` | Async HTTP (for subscriptions, templates) |
| `alembic` | Database migrations |
| `pyyaml` | YAML parsing (for subscriptions, config bodies) |

## Development Notes

- **Concurrency:** All subscription fetches happen concurrently via `asyncio.gather()`
- **Async resource cleanup:** HTTP clients use `async with` context managers
- **Stateless design:** Generate endpoints work without `DATABASE_URL` set
- **Format auto-detection:** Smart fallback from URL suffix → Content-Type → content sniff
- **Proxy model:** Unified Proxy discriminated union enables format-agnostic filtering

## Related Areas

- **[Format Support Layer](./formats.md)** — Parsers, emitters, unified proxy model
- **[Frontend Architecture](./frontend.md)** — Consumes these API endpoints
- **[INDEX](./INDEX.md)** — Overview of all codemaps
