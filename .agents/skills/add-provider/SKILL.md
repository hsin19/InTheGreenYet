---
name: add-provider
description: >-
  Add or extend an account-provider live-balance integration in this investment
  tracker — a Cloudflare Worker signing proxy plus a declarative frontend entry
  so an account can fetch its real balance from the provider's API. A "provider"
  is any API-connectable account source: a crypto exchange (Binance, Bitget, OKX,
  Bybit, Gate.io), a stock broker (Interactive Brokers, Firstrade, 富邦/元大 等券商),
  or a bank. Use this whenever the user wants to connect, sync, link, or pull
  balances from such a platform — including phrasings like "接 <name>",
  "add <name>", "connect <name>", "sync balance from <name>", "support <name>
  accounts", or "add unified/classic/API-version support". Not for unrelated
  Notion/config/transfer changes or cosmetic provider UI edits.
---

# Add an account-provider live-balance integration

## What this does

A "provider" is any API-connectable account source — a crypto exchange today, a
stock broker or bank later. Integrating one lets a user attach API credentials to
an account and pull its **total assets** live. The flow is a **stateless signing
proxy**:

```
AccountCard refresh ─▶ lib/<provider>.ts ─▶ POST /api/<provider>/balance
                                                   │
                          Worker signs with the user's secret, calls the
                          provider's read-only balance endpoint, sums wallets
                                                   │
                          ◀── { total, currency, fetchedAt }  (ProviderBalance)
```

The Worker never stores credentials — the frontend sends them per request, and
they live in the user's own Notion config. Each provider signs differently, so
**the signer is per-provider and not shared** — only the `ProviderBalance`
response shape and the frontend plumbing are common.

Two integrations already exist — **read both before writing anything**, not to copy
verbatim but to absorb the shape and idioms. A new provider may match neither; when it
doesn't, write its signer and balance logic fresh and keep them as their own clean
piece rather than forcing them into a template's mold. The boilerplate around them
(handler, lib wrapper, descriptor entry) still copies cleanly.

| Template                 | Credentials                   | Signing                                     |
| ------------------------ | ----------------------------- | ------------------------------------------- |
| `worker/binance.ts` | key + secret                  | HMAC-SHA256 of the query string, **hex**    |
| `worker/bitget.ts`  | key + secret + **passphrase** | HMAC-SHA256 of `ts+method+path`, **base64** |

**Encoding is two independent axes, not one toggle:** how the signed string is built
_and_ how the digest is encoded vary separately. MAX is a third combo — it signs a
**base64 payload** (a JSON of sorted `path`+`nonce`) yet hex-encodes the **signature**.
Don't classify a provider as "base64" or "hex"; confirm each axis on its own.

The frontend is fully declarative: adding a provider there is mostly **one entry**
in `src/pages/accounts/components/apiProviders.ts`.

## Step 0 — Research the provider API first (the part that varies)

This is where integrations actually differ; get it right before coding. Use the
provider's official API docs via whatever documentation lookup, browser, or web
fetch tool is available. **If the docs site is a JS-rendered SPA that fetch tools
return empty for, the provider's official SDK source is the authoritative fallback —
clone the repo and read it; signing, endpoints, and field names are all there. For
MAX this was the single biggest time-saver.** Pin down:

1. **Balance endpoint.** Prefer a single "total assets across all account types"
   endpoint (Binance `sapi/v1/asset/wallet/balance`, Bitget
   `/api/v2/account/all-account-balance`). If none exists, you may need to sum a
   few endpoints (spot + funding + futures…). Note the response shape and which
   field holds the per-wallet value. **Some exchanges report only per-asset balances
   with no valued total at all — MAX's `/api/v3/wallet/spot/accounts` returns
   `{currency, balance, locked, staked}` per coin. Then you must fetch the public
   tickers, build a price map, and value each asset yourself: direct `<coin><quote>`
   market if it exists, else bridge via `<coin>usdt × usdt<quote>`. Log any asset with
   no market, so a silent gap can't masquerade as a complete total.**
2. **Quote currency.** Does it accept a quote-asset param (Binance), or only
   report in one currency (Bitget is USDT-only)? This decides the `currency` you
   return and whether the account's currency matters.
3. **Credentials needed.** key + secret? a passphrase too? a token / account id?
4. **Signing scheme.** What string is signed (query? `ts+method+path+body`? a base64
   JSON payload carrying `path`+`nonce`, like MAX?), which HMAC hash, and the digest
   encoding (**hex vs base64** — easy to get wrong, and independent of how the signed
   string itself is encoded). Note any nonce/timestamp freshness window (MAX rejects a
   nonce more than 30s off server time).
5. **Required headers** (e.g. `X-MBX-APIKEY` vs `ACCESS-KEY` / `ACCESS-SIGN` /
   `ACCESS-TIMESTAMP` / `ACCESS-PASSPHRASE`).
6. **Error shape.** Read it carefully — see the gotcha about non-2xx bodies below.

Tell the user to create a **read-only** key with **IP access unrestricted** (the
Worker runs on Cloudflare's rotating IPs, so a fixed allowlist blocks it).

## Backend (mirror the closer template)

1. **`worker/<provider>.ts`** — `fetch<Provider>Total(...creds): Promise<ProviderBalance>`.
   - Sign with `crypto.subtle` (Web Crypto is in the Workers runtime — do **not**
     import Node `crypto`). For base64 use `btoa(String.fromCharCode(...new Uint8Array(sig)))`.
   - Parse the response, sum the wallet values, return `{ total, currency, fetchedAt }`.
   - On failure throw `ClientError` (from `./utils`) with a message the user can act
     on — distinguish bad-credential errors from IP/permission errors when the API
     gives you a code for it.
2. **`worker/handlers/<provider>.ts`** — validate that every required
   credential is present (throw `ClientError` if not), call the signer, return
   `jsonResponse` / `errorResponse`. No Notion token. Copy `handlers/bitget.ts`.
3. **`worker/index.ts`** — add `POST /api/<provider>/balance` next to the
   existing provider routes.
4. **`worker/model.ts`** — add `<Provider>BalanceRequest` (the credential
   fields). Reuse `ProviderBalance` for the response.

## Frontend

1. **`src/lib/model.ts`** — mirror the new `<Provider>BalanceRequest`
   (keep frontend/backend models in sync; `ProviderBalance` is already shared).
2. **`src/lib/<provider>.ts`** — `fetch<Provider>Balance(...creds)` →
   `apiFetch<ProviderBalance>("/api/<provider>/balance", null, { method: "POST", body })`.
   Copy `lib/bitget.ts`.
3. **`src/pages/accounts/components/apiProviders.ts`** — add one entry:
   ```ts
   <provider>: {
       label: "<Label>",
       fields: [API_KEY, API_SECRET /* , PASSPHRASE if needed */],
       guide: <Provider>KeyGuide,
       keyHint: "Use a read-only key.",   // optional: hint shown next to the guide link
       note: "…API coverage caveats…",    // optional: amber warning in the connect box
       fetchBalance: c => fetch<Provider>Balance(c.apiKey!, c.apiSecret!/* , c.apiPassphrase! */),
   }
   ```
   The account dialog and card render entirely from this — **no per-provider UI branching**.
   - `fields` items are either a **secret** (`CredentialField`, password input) or a
     **`{ kind: "select", options, default }`** dropdown (`SelectField`) — e.g. an
     account-mode picker. Both store on an `api*` key of `AccountConfig`; selects carry a
     default so they never block refresh (`hasCredentials` only requires secret fields).
   - `keyHint` / `note` are optional copy; `guide` renders as `<provider.guide />`;
     `fetchBalance` is the refresh dispatch.
4. **`<Provider>KeyGuide.tsx`** in the same components folder — copy
   `BitgetKeyGuide.tsx` (or `BinanceKeyGuide.tsx`), adjust the steps and the API
   management URL. Reuse the shared `CopyableValue` to offer copy-paste suggestions
   (the key label, a generated passphrase, …). Stress: read-only key, IP unrestricted,
   and any extra secret (e.g. passphrase) the provider issues.
5. **`AccountDialog.tsx`** — confirm the account-type `<Select>` has a
   `<SelectItem value="<provider>">`. The `value` **must equal** the
   `API_PROVIDERS` key. Add it if missing.

### If the provider needs a credential we don't model yet

`AccountConfig` stores provider inputs under `api*` keys (`apiKey` / `apiSecret` /
`apiPassphrase` / `apiMode`). `CredentialFieldName` is **derived** from those keys
(`Extract<keyof AccountConfig, \`api${string}\`>`), so for a genuinely new field (a UID,
a token, an account-mode select…):

- add the optional `api…`-prefixed field to `AccountConfig` in
  `src/hooks/useAppData.tsx` — the `api` prefix makes it auto-join
  `CredentialFieldName`, no union to hand-edit,
- add a `CredentialField` (secret) or `SelectField` (dropdown) constant in `apiProviders.ts`,
- reference it in the provider's `fields` and `fetchBalance`.

The dialog then renders it automatically.

## Verify

Run commands from the repo root.

Required:

- `pnpm run check` — format, lint, test, and build for the whole project. Backend
  build regenerates Worker types before typechecking; eslint is not type-aware.

If touching the backend signer or handler:

- Smoke test without real keys: start the worker with `pnpm run dev`, then
  `POST /api/<provider>/balance` with dummy credentials. Expect the request to reach
  the provider and come back as a friendly credential error — that proves the signing
  path runs end to end. A missing-field body should return the validation error.

Manual final check:

- Real read-only credentials in the UI are the final verification; the user normally
  runs this. If the total looks wrong, sign and call the endpoint directly in a
  throwaway script and print the per-bucket breakdown so you can see which
  wallet/product the provider does or doesn't report.

## Gotchas (learned the hard way)

- **The "all balance" endpoint may not be all of it.** Bitget's `all-account-balance`
  silently omits On-chain Earn (it was ~40% of one real account), and no API exposes it.
  Reconcile the live total against the provider's own app with a real key before trusting
  it, and surface any structural gap to the user via the descriptor's `note`.
- **Account-mode / API-version variants.** A provider may expose different endpoints per
  account mode — Bitget Classic uses v2 `all-account-balance`; Unified (UTA) uses v3
  `/api/v3/account/assets` and returns code `40084` for classic accounts. Model the
  choice as a `select` field (stored as `apiMode`) and branch in `fetchBalance` + the
  backend handler. Bitget's v3 signing is identical to v2 — only the path + parsing differ.
- **Read the error body even on non-2xx.** Providers signal failures both ways —
  Binance returns HTTP 401 with a JSON body; Bitget returns HTTP 400 _and_ an
  in-body `code` like `40037`. Parse the body regardless of status and key off the
  code so the user gets "Apikey does not exist", not "HTTP 400".
- **hex vs base64** is the most common signing mistake — and the payload encoding and
  the signature encoding are _separate_ choices (MAX = base64 payload + hex signature).
  Confirm both axes from the docs or the SDK source, not by analogy to another provider.
- **Public market-data endpoints have their own quirks.** When you need "all prices"
  to value holdings, verify the call actually returns everything: MAX's `/api/v3/tickers`
  rejects a param-less call (`markets is missing`), while v2 `/api/v2/tickers` returns
  every market in one shot. Pick the version that does what you need.
- **`erasableSyntaxOnly`** is on in tsconfig.app.json: no `enum`, `namespace`,
  or constructor parameter properties. Use plain field declarations / unions.
- **`<provider.guide />`** (dot notation) is a valid JSX component reference, so the
  guide can live in the descriptor without a per-provider ternary.
- **Naming:** "provider" is the umbrella (exchange / broker / bank). Don't confuse it
  with `lib/exchange.ts`, which is currency **exchange rates** — unrelated.
