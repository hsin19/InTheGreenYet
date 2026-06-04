# AGENTS.md

Personal investment tracker. React 19 SPA → Cloudflare Worker → Notion API (persistence) + 3rd-party provider APIs (live balances).

## Architecture

- **Frontend** — React 19 + Vite SPA on Cloudflare Pages. App state lives in the browser (`localStorage`, IndexedDB, in-memory React/SWR state). Notion OAuth login stores the access token in `localStorage`; from there the client drives every request, attaching whatever credential the target API needs.
- **Backend** — a **stateless** Cloudflare Worker that stores nothing. It's a uniform relay: the client sends a request carrying the right credential, the Worker calls the target API, normalizes the response, and returns it.
- **Notion is one of the 3rd-party APIs** — but it is currently the persistence backend. The user's own Notion workspace holds transfers, config, snapshots, and even other providers' API secrets (no shared/central database).
- **Persistence path** — reads and writes go through `DataStore` (`frontend/src/lib/datastore.ts`) via `useAppData`: `client + Notion token → Worker → Notion`. Reads are cached in IndexedDB and revalidated in the background (SWR).
- **Provider path** — live provider calls are separate from persistence: first read the provider secret from Notion config, then `client + that secret → Worker → provider` (no Notion token involved for the provider request itself).
- **Backend seam** — Notion is today's backend, not a hard dependency. `DataStore` is the swappable seam, so the app can later run IDB-only or point at a different remote.
- **Deploy** — Pages + Workers, both automatically via GitHub Actions CI. `wrangler` is for local dev, secrets, and debugging.

## Where to Start

- **Persisted user data** (transfers, config, snapshots) — start with `frontend/src/lib/datastore.ts` and the `useAppData` hook.
- **OAuth / login / logout / workspace-scoped browser state** — start with `useNotion` and the auth storage keys (`notion_auth`, `oauth_state`).
- **Worker routing / API entrypoints** — start with `backend/src/index.ts`.
- **Notion-specific behavior or eventual consistency** — start with `backend/src/notion.ts`.
- **A live balance provider integration** — start with `backend/src/handlers/` and use the `add-provider` skill for the full procedure.

## Workspace

pnpm workspaces (`pnpm-workspace.yaml`); **always run commands from the repo root**.

```bash
pnpm install
pnpm run dev          # frontend (5173) + backend (8787), concurrently
pnpm run lint         # eslint in all workspaces
pnpm run build        # frontend: tsc -b && vite build (real typecheck + bundle)
pnpm run format       # dprint fmt (write)
pnpm run format:check
pnpm run test
```

After changes, run `pnpm run check` — it covers what CI checks (format, lint, test, real typecheck).

Single-test examples from the repo root:

```bash
pnpm --filter @inthegreenyet/frontend test src/lib/exchange.test.ts
pnpm --filter @inthegreenyet/backend test --run test/index.test.ts
```

Useful workspace-specific variants:

```bash
pnpm --filter @inthegreenyet/frontend lint
pnpm --filter @inthegreenyet/backend lint
pnpm --filter @inthegreenyet/frontend test
CI=1 pnpm --filter @inthegreenyet/backend test
pnpm --filter @inthegreenyet/frontend build
pnpm --filter @inthegreenyet/backend build
```

## Frontend

### TypeScript Rules

- `erasableSyntaxOnly` is on in the frontend tsconfig — no TS-only runtime syntax: no `enum`, no `namespace`, no constructor parameter properties. Use explicit field declarations instead.

### Storage & State Rules

Persistence (transfers, config, snapshots) flows through `DataStore` in `frontend/src/lib/datastore.ts`, reached via the `useAppData` hook.

In local development, Vite proxies `/auth/*` and `/api/*` to the Worker, so frontend code should use relative `/auth/...` and `/api/...` paths.

Quick routing rule:

1. If it changes persisted user data, it should go through `useAppData` / `DataStore`.
2. If it fetches live provider balances, it should use `apiFetch` to call the Worker provider handler directly.
3. If it is about Notion OAuth state, login/logout, or workspace cleanup, it belongs with `useNotion`.
4. If it is about Notion search/create/delete consistency, handle it with the retry helpers in `backend/src/notion.ts`.

- **Persistence only via `useAppData`**: Page/UI components must **never** use `NotionStore` or call the persistence endpoints (`/api/transfers`, `/api/config`, `/api/snapshots`, `/api/init`) directly. Always go through the `useAppData` wrappers (`addTransfer`, `addSnapshots`, `saveConfig`).
- **Provider calls are a separate path**: live 3rd-party fetches (`lib/binance`, `lib/bitget`, `lib/max`) hit the Worker directly via `apiFetch` — they are **not** persisted and do **not** go through `DataStore`. The caller already holds the credentials (read from config), so no Notion token is involved.
- **Auth vs. Storage Lifecycle**: `useNotion` is strictly for OAuth state (login/logout). The storage initialization lifecycle (provisioning Notion data sources) is triggered on-demand by `SwrStore` upon encountering `DataSourceNotFoundError`.

### Authentication State

- Notion Public Integration OAuth. Access token is stored in `localStorage` (`notion_auth`).
- `workspace_id` acts as the IndexedDB namespace (`inthegreenyet-<workspace_id>`).
- CSRF protected via `state` round-trip through `sessionStorage` (`oauth_state`).
- Logout calls `disposeWorkspaceData(workspaceId)` which deletes the IDB database.

### Localization

- Frontend i18n uses Lingui (`@lingui/*` with the SWC/Vite plugins). Follow existing Lingui message patterns when changing user-facing text.

## Backend

### Notion API Integration

- Entry: [backend/src/index.ts](backend/src/index.ts) dispatches by URL pathname.
- Handlers in `backend/src/handlers/` are thin; Notion logic is in [backend/src/notion.ts](backend/src/notion.ts).
- `/api/init` provisions Transfer/Config/Snapshots data sources and **blocks until each is searchable** (`waitForDataSource`), masking Notion's eventual consistency.

### Live-Balance Provider Proxies

The Worker also signs and proxies read-only balance requests to 3rd-party account
providers. It stays stateless: the client passes the provider credentials on each
request (they live in the user's Notion config, never on the Worker), and the
Worker signs and relays the call. One handler per provider in
`backend/src/handlers/`, each served at `/api/<provider>/balance` (POST). Adding
one is a procedure — see the **add-provider** skill.

### Notion API Caveats (Eventual Consistency)

Notion has three independent eventual-consistency surfaces:

1. Newly created data sources are not immediately searchable.
2. Deleted ones can linger in search results for a while.
3. A search hit can reference a page that already returns 404 on fetch.

**Rule**: Never trust a single `search` call. Use the retry helpers in [backend/src/notion.ts](backend/src/notion.ts) (`searchDataSource` with `retries`, `waitForDataSource`, `resolveDataSource`). On the frontend, `SwrStore` already retries via `DataSourceNotFoundError`.
