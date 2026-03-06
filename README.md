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
   - Go to [notion.so/profile/integrations/public](https://www.notion.so/profile/integrations/public)
   - Create a new **Public** integration
   - Set Redirect URI to `http://localhost:5173/auth/notion/callback`
   - Copy your **Client ID** and **Client Secret**

### Setup

```bash
# Install dependencies for both frontend and backend
npm install

# Copy example environment variables and fill in the values
cp -n backend/.dev.vars.example backend/.dev.vars
cp -n frontend/.env.example frontend/.env.local
```

### Run

```bash
# Run both frontend and backend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and click **Connect to Notion** to start.

> In dev, Vite proxies `/auth/*` and `/api/*` to the Worker automatically. No extra configuration needed.

## Deployment

Deployments are handled via GitHub Actions:

- **Frontend** → Cloudflare Pages (`build-frontend.yml` → `deploy-frontend.yml`)
- **Backend** → Cloudflare Workers (`deploy-backend.yml`)

### 1. Cloudflare Setup

1. Sign up / log in at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to the [Workers & Pages dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages) and note down your **Account ID** and **Workers Subdomain** (found in the right sidebar under **Account Details**)
3. Create an **API Token**:
   - Go to **My Profile > API Tokens > Create Token**
   - Use the **Edit Cloudflare Workers** template (or create a custom token with `Workers Scripts:Edit`, `Pages:Edit`, `Account Settings:Read` permissions)
   - Copy the generated token

### 2. Notion Integration (Production)

> **Tip:** Use a separate integration from your local dev one to avoid accidentally revoking tokens or misconfiguring Redirect URIs.

1. Go to [notion.so/profile/integrations/public](https://www.notion.so/profile/integrations/public)
2. Create a new **Public** integration for production
3. Set **Redirect URI** to your Worker URL:
   `https://inthegreenyet.<your-workers-subdomain>.workers.dev/auth/notion/callback`
4. Copy the **Client ID** and **Client Secret**

### 3. GitHub Secrets & Variables

Add these in your repo's **Settings > Secrets and variables > Actions**:

#### Repository Secrets (Sensitive)

| Secret                 | Description                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token ([Guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/#api-token)) |
| `NOTION_CLIENT_SECRET` | Notion integration client secret (production)                                                                           |

#### Repository Variables (Non-sensitive)

| Variable                       | Description                                          |
| ------------------------------ | ---------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`        | Your Cloudflare account ID                           |
| `CLOUDFLARE_PAGE_NAME`         | Cloudflare Pages project name (e.g. `inthegreenyet`) |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Your Cloudflare Workers subdomain (e.g. `hsin19`)    |
| `NOTION_CLIENT_ID`             | Notion integration client ID (production)            |

Once configured, pushing to `main` will automatically deploy the affected services.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Backend**: Cloudflare Workers
- **Database**: Notion API (v2025-09-03)
- **Auth**: Notion OAuth 2.0
- **CI/CD**: GitHub Actions

## License

MIT
