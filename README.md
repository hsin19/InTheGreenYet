# InTheGreenYet

It's not about today's profit — it's about knowing where you truly stand.

A personal investment tracking app powered by [Notion](https://www.notion.so/) as the database backend. Your data stays in your own Notion workspace.

## Architecture

```
frontend/   → React + TypeScript + Tailwind (Vite)
backend/     → Cloudflare Worker (OAuth + Notion API)
```

The **backend** worker handles all Notion API interactions (OAuth, database setup, schema management) so the frontend stays a thin client. The two can be deployed on the same or different domains.

## Getting Started

### Prerequisites

1. [Node.js](https://nodejs.org/) v22+
2. A **Notion Public Integration**:
   - Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations)
   - Create a new **Public** integration
   - Set Redirect URI to `http://localhost:5173/auth/notion/callback`
   - Copy your **Client ID** and **Client Secret**

### Setup

```bash
# Backend — configure secrets
cd backend
cp .dev.vars.example .dev.vars
# Edit .dev.vars → fill in NOTION_CLIENT_ID, NOTION_CLIENT_SECRET
npm install

# Frontend — configure env
cd ../frontend
cp .env.example .env.local
# Edit .env.local → fill in VITE_NOTION_CLIENT_ID
npm install
```

### Run

```bash
# Terminal 1 — Backend Worker (port 8787)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and click **Connect to Notion** to start.

> In dev, Vite proxies `/auth/*` and `/api/*` to the Worker automatically. No extra configuration needed.

## Deployment

Deployments are handled via GitHub Actions (`.github/workflows/deploy.yml`):

- **Frontend** → Cloudflare Pages
- **Backend** → Cloudflare Workers

### GitHub Secrets & Variables

Add these in **Settings > Secrets and variables > Actions**:

#### Repository Secrets (Sensitive)

> **Tip:** Use separate Notion integrations for local dev and production to avoid accidentally revoking tokens or misconfiguring Redirect URIs.

| Secret                 | Description                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token ([Guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/#api-token)) |
| `NOTION_CLIENT_SECRET` | Notion integration client secret                                                                                        |

#### Repository Variables (Non-sensitive configs)

> **Tip:** You can find both your `Account ID` and `Workers Subdomain` in the **Account Details** section of the [Workers & Pages Dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages).

| Variable                       | Description                                          |
| ------------------------------ | ---------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`        | Your Cloudflare account ID                           |
| `CLOUDFLARE_PAGE_NAME`         | Cloudflare Pages project name (e.g. `inthegreenyet`) |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Your Cloudflare Workers subdomain (e.g. `hsin19`)    |
| `NOTION_CLIENT_ID`             | Notion integration client ID                         |

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Backend**: Cloudflare Workers
- **Database**: Notion API (v2025-09-03)
- **Auth**: Notion OAuth 2.0
- **CI/CD**: GitHub Actions

## License

MIT
