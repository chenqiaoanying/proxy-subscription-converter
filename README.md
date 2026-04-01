# Proxy Subscribe Converter

A serverless web app that aggregates sing-box proxy subscriptions, lets you define filters, and generates a ready-to-use sing-box config — with or without a database.

## Features

- Manage multiple proxy subscription URLs with custom names and group tags
- Define filters with include/exclude rules (pattern, proxy type, regex, case sensitivity)
- Generate sing-box configs on demand — proxies are always fetched live (no caching)
- Monaco editor for inline JSON template editing with sing-box schema validation
- **Stateless mode**: no database required — host your config on GitHub Gist or S3 and use a stable `?url=` generate link
- **Server-side mode**: optionally save configs to Neon PostgreSQL for a permanent per-ID generate URL

## Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Element Plus + Pinia
- **Backend**: Python FastAPI (serverless via Mangum on Vercel)
- **Database**: Neon PostgreSQL — optional, only needed for server-side config storage

## Quick Start (no database)

```bash
git clone <repo>
cd proxy-subscribe-converter

# Install dependencies
uv venv .venv && uv pip install -r api/requirements.txt
cd frontend && npm install && cd ..

# Run both dev servers (two terminals)
.venv/bin/uvicorn api.index:app --reload --port 8000
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). No `.env` file needed.

## Usage

### Option A — Stateless (no database, recommended for self-hosting)

1. Build your config in the UI editor (Subscriptions, Filters, Template tabs)
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
        "tag": "Airport",
        "enabled": true,
        "user_agent": "clashmeta"
      }
    },
    "filters": [
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
        "subscriptions": ["my_airport"]
      }
    ]
  },
  "config_template": "https://example.com/template.json"
}
```

`config_template` can be a URL (fetched at generate time) or an inline JSON object.

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
DATABASE_URL=postgresql+asyncpg://... alembic -c alembic/alembic.ini upgrade head
```

> Alembic automatically swaps `+asyncpg` → `+psycopg` internally for the sync migration run.

## Deploy to Vercel

1. Push to GitHub and import the project in Vercel
2. To enable server-side storage: add `DATABASE_URL` in Vercel project settings (or use the Neon integration to auto-populate it)
3. Without `DATABASE_URL`, only the stateless endpoints are available — the app still works fully for Option A

> **Note**: Vercel Hobby plan limits serverless function execution to 10 seconds. For slow subscription URLs, upgrade to Pro (`maxDuration: 60` in `vercel.json` will then apply).
