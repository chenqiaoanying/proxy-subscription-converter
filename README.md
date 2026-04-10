# Proxy Subscribe Converter

A serverless web app that aggregates sing-box proxy subscriptions, lets you define filters, and generates a ready-to-use sing-box config — with or without a database.

## Features

- Manage multiple proxy subscription URLs with custom names
- Define static groups with include/exclude rules (pattern, proxy type, regex, case sensitivity)
- Auto-region groups that dynamically expand into a parent outbound group containing per-region sub-groups at generate-time
- Generate sing-box configs on demand — proxies are always fetched live (no caching)
- Monaco editor for inline JSON template editing with sing-box schema validation
- **Stateless mode**: no database required — host your config on GitHub Gist or S3 and use a stable `?url=` generate link
- **Server-side mode**: optionally save configs to Neon PostgreSQL for a permanent per-ID generate URL

## Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Element Plus + Pinia
- **Backend**: Python FastAPI (deployed as a Vercel Service)
- **Database**: Neon PostgreSQL — optional, only needed for server-side config storage

## Quick Start (no database)

```bash
git clone <repo>
cd proxy-subscribe-converter

# Install dependencies
cd backend && uv sync && cd ..
cd frontend && npm install && cd ..

# Run both dev servers (two terminals)
cd backend && uv run uvicorn src.app.index:app --reload --port 8000
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). No `.env` file needed.

## Usage

### Option A — Stateless (no database, recommended for self-hosting)

1. Build your config in the UI editor (Subscriptions, Groups, Template tabs)
2. Go to the **Generate** tab → click **Export Config JSON**
3. Upload the exported file to [GitHub Gist](https://gist.github.com) or S3, copy the raw URL
4. Paste the raw URL in the **Stateless Generate URL** section — the generate link is built for you
5. Use that URL as a remote profile in sing-box:

```
GET https://your-app.vercel.app/api/generate?url=https://gist.githubusercontent.com/user/abc/raw/config.json
```

No account needed on the converter server. The config lives in your own Gist/S3.

You can also generate and download a sing-box config directly from the UI without any URL setup (**Generate & Download** button in the Generate tab).

### Option B — Server-side (with database)

Each saved config gets a permanent generate URL: `/api/configs/{id}/generate`

Set up the database (see below), save your config via the UI, and point sing-box at the generated URL.

### Config document structure

```json
{
  "subscriber": {
    "subscriptions": {
      "my_airport": {
        "url": "https://example.com/subscribe?token=xxx",
        "enabled": true,
        "user_agent": "clashmeta"
      }
    },
    "groups": [
      {
        "tag": "HK Nodes",
        "type": "selector",
        "include": {
          "pattern": "HK|Hong Kong",
          "proxy_type": [],
          "regex": true,
          "match_case": false,
          "match_whole_word": false
        },
        "exclude": null,
        "imports": ["my_airport"]
      },
      {
        "group_tag": "My Proxies",
        "type": "auto_region",
        "group_type": "selector",
        "sub_group_tag": "{region} Nodes",
        "sub_group_type": "urltest",
        "imports": ["my_airport"],
        "regions": "auto",
        "others_tag": "Others",
        "region_map": {},
        "use_emoji": true,
        "include": null,
        "exclude": null
      }
    ]
  },
  "config_template": "https://example.com/template.json"
}
```

`config_template` can be a URL (fetched at generate time) or an inline JSON object.

**Group types:**

- **Static** (`type: "selector" | "urltest"`): Creates a single outbound group. Collects proxies from the `imports` list and applies include/exclude rules to filter them.
- **Auto-region** (`type: "auto_region"`): Dynamically generates a parent outbound group containing one sub-group per detected region. `group_tag` names the parent; `sub_group_tag` is a template with a `{region}` placeholder (e.g., `"{region} Nodes"` → `"HK Nodes"`, `"JP Nodes"`, …). `group_type` sets the parent's sing-box type; `sub_group_type` sets the sub-groups' type. Use `regions: "auto"` to detect all regions dynamically (unmatched proxies go into an `"Others"` catch-all), or specify `regions: ["HK", "JP", "US"]` to emit groups in that explicit order.

**`imports` field**: Each item in `imports` can be either a subscription name (draws raw proxies from that subscription) or another group's tag (draws that group's filtered proxy output, enabling composition). Leave empty to use all subscriptions. Circular imports are detected and fall back to definition order.

## API

| Method | Path | DB required | Description |
|---|---|---|---|
| `POST` | `/api/generate` | No | Body: `ConfigData` JSON — generate and return sing-box config |
| `GET` | `/api/generate?url=<url>` | No | Fetch `ConfigData` from URL, generate and return |
| `GET` | `/api/configs/{id}/generate` | Yes | Load config from DB by ID, generate and return |
| `GET` | `/api/configs` | Yes | List all saved configs |
| `POST` | `/api/configs` | Yes | Create a config |
| `GET/PUT/DELETE` | `/api/configs/{id}` | Yes | Read / update / delete a config |

## Database Setup (optional)

Only needed for Option B (server-side config storage).

### 1. Create a Neon database

Sign up at [neon.tech](https://neon.tech), create a project, and copy the connection string.

### 2. Configure environment

```bash
cp .env.example .env
```

`.env`:
```
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?sslmode=require
```

### 3. Run migrations

```bash
# Alembic reads DATABASE_URL from the environment (not .env)
DATABASE_URL=postgresql+asyncpg://... cd backend && uv run alembic -c alembic/alembic.ini upgrade head
```

> Alembic automatically swaps `+asyncpg` → `+psycopg` internally for the sync migration run.

## Deploy to Vercel

1. Push to GitHub and import the project in Vercel
2. To enable server-side storage: add `DATABASE_URL` in Vercel project settings (or use the Neon integration to auto-populate it)
3. Without `DATABASE_URL`, only the stateless endpoints are available — the app still works fully for Option A

> **Note**: Vercel Hobby plan limits function execution to 10 seconds. For slow subscription URLs, upgrade to Pro (`maxDuration: 60` is already set in `vercel.json`).
