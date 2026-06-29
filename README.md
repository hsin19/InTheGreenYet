# InTheGreenYet

It's not about today's profit — it's about knowing where you truly stand.

A personal investment tracking app powered by [Notion](https://www.notion.so/) as the database backend. Your data stays in your own Notion workspace.

## Architecture

```
src/      → React 19 + TypeScript + Tailwind SPA (Vite)
worker/   → Cloudflare Worker (OAuth + Notion API + provider proxies)
```

One **Cloudflare Worker** serves the SPA's static assets and the `/api`, `/auth` routes on a single origin — the client and the Worker are built together by [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/) using Workers Static Assets. The Worker handles all Notion API interactions (OAuth, database setup, schema management) and signs provider balance requests, so the SPA stays a thin client that calls `/api` relative — no CORS, no separate API host.

## Getting Started

### Prerequisites

1. [Node.js](https://nodejs.org/) v22+
2. A **Notion Public Integration**:
   - Go to [notion.so/profile/integrations/public](https://www.notion.so/profile/integrations/public)
   - Create a new **Public** integration
   - Set Redirect URI to `http://localhost:4152/auth/notion/callback`
   - Copy your **Client ID** and **Client Secret**

### Setup

```bash
# Install dependencies
pnpm install

# Copy the example config and fill in the values (one file — the SPA fetches the
# public Notion client id from the Worker, so there is no separate client-side env)
cp -n .dev.vars.example .dev.vars   # NOTION_CLIENT_ID, NOTION_CLIENT_SECRET
```

### Run

```bash
pnpm run dev
```

`vite` runs the SPA **and** the Worker together on one origin with HMR. Open
[http://localhost:4152](http://localhost:4152) and click **Connect to Notion** to
start. The SPA calls `/api` and `/auth` on the same origin — no proxy needed.

## Deployment

A single Cloudflare Worker (SPA assets + API) is deployed via GitHub Actions
(`deploy.yml`): `pnpm run build` then `wrangler deploy`.

### 1. Cloudflare Setup

1. Sign up / log in at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to the [Workers & Pages dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages) and note down your **Account ID** and **Workers Subdomain** (found in the right sidebar under **Account Details**)
3. Create an **API Token**:
   - Go to **My Profile > API Tokens > Create Token**
   - Use the **Edit Cloudflare Workers** template (or a custom token with `Workers Scripts:Edit`, `Account Settings:Read`)
   - Copy the generated token

### 2. Notion Integration (Production)

> **Tip:** Use a separate integration from your local dev one to avoid accidentally revoking tokens or misconfiguring Redirect URIs.

1. Go to [notion.so/profile/integrations/public](https://www.notion.so/profile/integrations/public)
2. Create a new **Public** integration for production
3. Set **Redirect URI** to your Worker URL (the SPA is served from the same origin):
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

| Variable                       | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`        | Your Cloudflare account ID                        |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Your Cloudflare Workers subdomain (e.g. `hsin19`) |
| `NOTION_CLIENT_ID`             | Notion integration client ID (production)         |

Once configured, pushing to `main` automatically deploys the Worker.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Backend**: Cloudflare Workers + Static Assets (`@cloudflare/vite-plugin`)
- **Database**: Notion API (v2025-09-03)
- **Auth**: Notion OAuth 2.0
- **CI/CD**: GitHub Actions

## License

MIT
