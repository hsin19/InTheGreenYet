# InTheGreenYet

It’s not about today’s profit — it’s about knowing where you truly stand.

## Architecture

```
/frontend   → React + TypeScript + Tailwind (Vite)  → CF Pages
/proxy      → CF Worker (auth + Notion API proxy)
```

**Database:** Notion (via OAuth)

## Development

### Prerequisites

1. **Create a Notion Public Integration**
   - Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations)
   - Create a new **Public** integration
   - Set Redirect URI: `http://localhost:8787/auth/notion/callback`
   - Copy your **Client ID** and **Client Secret**

### Setup

```bash
# 1. Proxy — configure secrets
cd proxy
cp .dev.vars.example .dev.vars
# Edit .dev.vars → fill NOTION_CLIENT_ID, NOTION_CLIENT_SECRET
npm install

# 2. Frontend — configure env
cd frontend
cp .env.example .env.local
# Edit .env.local → fill VITE_NOTION_CLIENT_ID
npm install
```

### Run

```bash
# Terminal 1 — Proxy Worker (port 8787)
cd proxy && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and click **Connect to Notion** to start.

> Vite proxies `/auth/*` requests to the Worker automatically during dev.

## Deployment

GitHub Actions → Cloudflare Pages + Workers
