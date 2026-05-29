# AGENTS.md

Personal investment tracker. React 19 SPA → Cloudflare Worker → Notion API.

## Skills

Reusable task procedures live as `SKILL.md` files. When a task matches the
description below, **read the full file before acting** — don't work from this
summary alone.

- **add-provider** — connect a new account provider's live-balance API
  (crypto exchange / stock broker / bank): a Worker signing proxy plus a
  declarative frontend entry. → `skills/add-provider/SKILL.md`

## Workspace

npm workspaces; **always run commands from the repo root**.

```bash
npm run dev          # frontend (5173) + backend (8787), concurrently
npm run lint         # eslint in all workspaces
npm run build        # frontend: tsc -b && vite build (real typecheck + bundle)
npm run format       # dprint fmt (write)
npm run format:check
npm run test
```

`npm run lint` (eslint) is **not** type-aware. To catch TS type errors
run `npm run build` — it's what CI runs.

`erasableSyntaxOnly` is on in the frontend tsconfig — no TS-only
runtime syntax: no `enum`, no `namespace`, no constructor parameter
properties (`constructor(private foo)`). Use explicit field
declarations instead.

## Frontend storage architecture

All persistence flows through a `DataStore` interface in
`frontend/src/lib/datastore.ts`:

- **`NotionStore`** — REST proxy to backend `/api/*`. No cache.
- **`IdbStore`** — pure IndexedDB. Used as the cache layer behind
  `SwrStore`, and reserved for a future local-only mode (self-issues
  UUIDs, no upstream).
- **`SwrStore`** — wraps `IdbStore + NotionStore`. Hydrate from IDB
  first (so cold start is ~100ms), revalidate Notion in background,
  auto-trigger `init()` and retry on `DataSourceNotFoundError`.
- **`ReadOnlyStore`** — decorator that throws on writes; reserved for a
  future offline mode.

`createDataStore({ auth })` is the factory.

`useAppData` (`frontend/src/hooks/useAppData.tsx`) is a thin
orchestration layer over whichever store the factory returns. Page
components never import `lib/notion` directly — they use
`addTransfer / addSnapshots / saveConfig` from `useAppData`.

`useNotion` is auth-only (login, logout, OAuth state). It does **not**
own init lifecycle anymore — the first failing query inside `SwrStore`
provisions data sources on demand.

## Backend (Cloudflare Worker)

For detailed Cloudflare Worker APIs, limits, and product documentation, see [backend/AGENTS.md](backend/AGENTS.md).

- Entry: `backend/src/index.ts` dispatches by URL pathname.
- Handlers in `backend/src/handlers/` are thin; Notion logic is in
  `backend/src/notion.ts`.
- `/api/init` provisions Transfer/Config/Snapshots data sources and
  **blocks until each is searchable** (`waitForDataSource`), masking
  Notion's eventual consistency.

## Notion API caveats

Notion has three independent eventual-consistency surfaces:

1. Newly created data sources are not immediately searchable.
2. Deleted ones can linger in search results for a while.
3. A search hit can reference a page that already returns 404 on
   fetch.

Never trust a single `search` call. Use the retry helpers in
`backend/src/notion.ts` (`searchDataSource` with `retries`,
`waitForDataSource`, `resolveDataSource`). On the frontend, the
`SwrStore` already retries via `DataSourceNotFoundError`.

## Auth

Notion Public Integration OAuth. Access token in `localStorage`
(`notion_auth`); `workspace_id` is the IDB namespace
(`inthegreenyet-<workspace_id>`). CSRF protected via `state` round-trip
through `sessionStorage` (`oauth_state`).

Logout calls `disposeWorkspaceData(workspaceId)` which deletes the
IDB database.
