# AGENTS.md

Personal investment tracker. A React 19 SPA and a Cloudflare Worker ship as **one Worker on one origin**: the Worker serves the SPA's static assets and handles the `/api`, `/auth`, `/health` routes, relaying to the Notion API (persistence) + 3rd-party provider APIs (live balances).

## Architecture

- **Single Worker, single origin** — `@cloudflare/vite-plugin` builds the SPA client and the Worker together. In production the Worker serves the built SPA via **Workers Static Assets** and handles `/api/*`, `/auth/*`, `/health` itself (see `assets.run_worker_first` in `wrangler.jsonc`). No separate Pages deploy, no CORS hop, no `VITE_API_BASE_URL` — the client calls `/api` and `/auth` relative on the same origin.
- **Frontend (`src/`)** — React 19 + Vite SPA. App state lives in the browser (`localStorage`, IndexedDB, in-memory React/SWR state). Notion OAuth login stores the access token in `localStorage`; from there the client drives every request, attaching whatever credential the target API needs.
- **Worker (`worker/`)** — a **stateless** relay that stores nothing. The client sends a request carrying the right credential, the Worker calls the target API, normalizes the response, and returns it. It also serves the SPA static assets (the `ASSETS` binding).
- **Notion is one of the 3rd-party APIs** — but it is currently the persistence backend. The user's own Notion workspace holds transfers, config, snapshots, and even other providers' API secrets (no shared/central database).
- **Persistence path** — reads and writes go through `DataStore` (`src/lib/datastore.ts`) via `useAppData`: `client + Notion token → Worker → Notion`. Reads are cached in IndexedDB and revalidated in the background (SWR).
- **Provider path** — live provider calls are separate from persistence: first read the provider secret from Notion config, then `client + that secret → Worker → provider` (no Notion token involved for the provider request itself).
- **Backend seam** — Notion is today's backend, not a hard dependency. `DataStore` is the swappable seam, so the app can later run IDB-only or point at a different remote.
- **Deploy** — one Cloudflare Worker (SPA assets + API) via GitHub Actions (`deploy.yml`): `pnpm run build` (the vite-plugin emits the client build + Worker bundle + a `.wrangler/deploy` redirect config) then `wrangler deploy`. `wrangler` is also used for local dev, secrets, and debugging.

## Where to Start

- **Persisted user data** (transfers, config, snapshots) — start with `src/lib/datastore.ts` and the `useAppData` hook.
- **OAuth / login / logout / workspace-scoped browser state** — start with `useNotion` and the auth storage keys (`notion_auth`, `oauth_state`).
- **Worker routing / API entrypoints** — start with `worker/index.ts`.
- **Single-origin routing config** (which paths hit the Worker vs are served as the SPA) — `assets.run_worker_first` + `assets.not_found_handling` in `wrangler.jsonc`.
- **Notion-specific behavior or eventual consistency** — start with `worker/notion.ts`.
- **A live balance provider integration** — start with `worker/handlers/` and use the `add-provider` skill for the full procedure.

## Project Layout & Commands

Single pnpm package (no workspace). React SPA in `src/`, Cloudflare Worker in `worker/`, both built by one `vite.config.ts` (`@cloudflare/vite-plugin`). **Always run commands from the repo root.**

```bash
pnpm install
pnpm run dev          # vite: SPA + Worker on ONE origin (http://localhost:5173) with HMR
pnpm run lint         # eslint (src/ + worker/)
pnpm run typecheck    # wrangler types + tsc -b (app/worker/node) + worker test tsconfig
pnpm run build        # wrangler types + tsc -b + vite build (client + Worker bundle)
pnpm run format       # dprint fmt (write)
pnpm run format:check
pnpm run test         # SPA tests (node + Chromium) then Worker pool tests
pnpm run test:e2e     # Playwright: browser → single-origin Worker → mock Notion
pnpm run deploy       # build + wrangler deploy (one Worker: assets + API)
```

After changes, run `pnpm run check` — it covers what CI checks (format, lint, real typecheck, tests, build).

Tests live in two configs, kept separate so the workerd pool never mixes with the browser provider:

- `vite.config.ts` `test.projects` — SPA `unit` (node, `src/**/*.test.ts`) + `browser` (Chromium, `src/**/*.test.tsx`).
- `vitest.worker.config.ts` — Worker integration tests (`worker/**/*.test.ts`) in the Cloudflare Workers pool (`cloudflareTest`).

Single-test examples from the repo root:

```bash
pnpm exec vitest run src/lib/exchange.test.ts
pnpm exec vitest run --config vitest.worker.config.ts worker/test/index.test.ts
```

## Frontend

### TypeScript Rules

- `erasableSyntaxOnly` is on in `tsconfig.app.json` — no TS-only runtime syntax: no `enum`, no `namespace`, no constructor parameter properties. Use explicit field declarations instead.

### Storage & State Rules

Persistence (transfers, config, snapshots) flows through `DataStore` in `src/lib/datastore.ts`, reached via the `useAppData` hook.

The SPA and the API share one origin, so frontend code uses **relative** `/auth/...` and `/api/...` paths (no `VITE_API_BASE_URL` in normal same-origin operation).

Quick routing rule:

1. If it changes persisted user data, it should go through `useAppData` / `DataStore`.
2. If it fetches live provider balances, it should use `apiFetch` to call the Worker provider handler directly.
3. If it is about Notion OAuth state, login/logout, or workspace cleanup, it belongs with `useNotion`.
4. If it is about Notion search/create/delete consistency, handle it with the retry helpers in `worker/notion.ts`.

- **Persistence only via `useAppData`**: Page/UI components must **never** use `NotionStore` or call the persistence endpoints (`/api/transfers`, `/api/config`, `/api/snapshots`, `/api/init`) directly. Always go through the `useAppData` wrappers (`addTransfer`, `addSnapshots`, `saveConfig`).
- **Provider calls are a separate path**: live 3rd-party fetches (`lib/binance`, `lib/bitget`, `lib/max`) hit the Worker directly via `apiFetch` — they are **not** persisted and do **not** go through `DataStore`. The caller already holds the credentials (read from config), so no Notion token is involved.
- **Auth vs. Storage Lifecycle**: `useNotion` is strictly for OAuth state (login/logout). The storage initialization lifecycle (provisioning Notion data sources) is triggered on-demand by `SwrStore` upon encountering `DataSourceNotFoundError`.

### Authentication State

- Notion Public Integration OAuth. Access token is stored in `localStorage` (`notion_auth`).
- `workspace_id` acts as the IndexedDB namespace (`inthegreenyet-<workspace_id>`).
- CSRF protected via `state` round-trip through `sessionStorage` (`oauth_state`).
- The OAuth `redirect_uri` is same-origin (`<origin>/auth/notion/callback`), derived from `window.location.origin` on the client and the request `url.origin` in the Worker. The registered redirect URI in the Notion integration must match this origin.
- Logout calls `disposeWorkspaceData(workspaceId)` which deletes the IDB database.

### Localization

- Frontend i18n uses Lingui (`@lingui/*` with the SWC/Vite plugins). Follow existing Lingui message patterns when changing user-facing text.

## Backend

### Notion API Integration

- Entry: [worker/index.ts](worker/index.ts) dispatches by URL pathname. Only `/api/*`, `/auth/*`, and `/health` reach the Worker (`assets.run_worker_first`); everything else is served as a static asset, and unknown client routes fall back to `index.html` (`assets.not_found_handling: single-page-application`). Adding a new server route means adding its prefix to `run_worker_first`.
- Handlers in `worker/handlers/` are thin; Notion logic is in [worker/notion.ts](worker/notion.ts).
- `/api/init` provisions Transfer/Config/Snapshots data sources and **blocks until each is searchable** (`waitForDataSource`), masking Notion's eventual consistency.

### Live-Balance Provider Proxies

The Worker also signs and proxies read-only balance requests to 3rd-party account
providers. It stays stateless: the client passes the provider credentials on each
request (they live in the user's Notion config, never on the Worker), and the
Worker signs and relays the call. One handler per provider in
`worker/handlers/`, each served at `/api/<provider>/balance` (POST). Adding
one is a procedure — see the **add-provider** skill.

### Notion API Caveats (Eventual Consistency)

Notion has three independent eventual-consistency surfaces:

1. Newly created data sources are not immediately searchable.
2. Deleted ones can linger in search results for a while.
3. A search hit can reference a page that already returns 404 on fetch.

**Rule**: Never trust a single `search` call. Use the retry helpers in [worker/notion.ts](worker/notion.ts) (`searchDataSource` with `retries`, `waitForDataSource`, `resolveDataSource`). On the frontend, `SwrStore` already retries via `DataSourceNotFoundError`.
