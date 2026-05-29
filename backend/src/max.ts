import type { ProviderBalance } from "./model";
import { ClientError } from "./utils";

const MAX_BASE = "https://max-api.maicoin.com";
const ACCOUNTS_PATH = "/api/v3/wallet/spot/accounts";
// v3 /tickers requires an explicit `markets` list; the v2 endpoint returns every
// market keyed by id in one public call, which is what we need to price holdings.
const TICKERS_URL = `${MAX_BASE}/api/v2/tickers`;

interface MaxAccount {
    currency: string;
    balance: string;
    locked: string;
    staked: string | null;
}

interface MaxErrorBody {
    success?: boolean;
    error?: { code: number; message: string; };
}

interface MaxTicker {
    last: string;
}

/**
 * Build an error detail from a failed response. MAX's API wraps failures in
 * `{ error: { code, message } }`, but a non-JSON body means the request never
 * reached the API — usually Cloudflare's edge blocking this server's IP, which we
 * detect so the message points at the real cause instead of a guessed-at one.
 */
async function readError(res: Response): Promise<{ detail: string; code?: number; edgeBlocked: boolean; }> {
    const text = await res.text().catch(() => "");
    let code: number | undefined;
    let message: string | undefined;
    try {
        const json = JSON.parse(text) as MaxErrorBody;
        code = json.error?.code;
        message = json.error?.message;
    } catch {
        // non-JSON body (HTML challenge page, empty, etc.)
    }
    // Log the raw response so `wrangler tail` shows exactly what MAX returned.
    console.error(`MAX ${res.status} response:`, text.slice(0, 500));
    const edgeBlocked = !message && /cloudflare|attention required|cf-ray|just a moment|access denied/i.test(text);
    // When it isn't MAX's JSON error envelope, surface a snippet of the body so the
    // real cause is visible in the UI instead of a bare status code.
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
    const detail = message ? `${message} (code ${code})` : `HTTP ${res.status}${snippet ? `: ${snippet}` : ""}`;
    return { detail, code, edgeBlocked };
}

/**
 * MAX signs the *base64-encoded* JSON payload (which itself carries the request
 * path + nonce) with HMAC-SHA256 and hex-encodes the digest — base64 payload but
 * hex signature, unlike Binance (hex over the query) or Bitget (base64 digest).
 */
async function signMax(secret: string, payload: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Fetch every spot-wallet currency balance via the signed accounts endpoint. */
async function fetchSpotAccounts(apiKey: string, apiSecret: string): Promise<MaxAccount[]> {
    const nonce = Date.now();
    // Payload keys must be sorted; with only nonce + path that's already the order.
    const payload = btoa(JSON.stringify({ nonce, path: ACCOUNTS_PATH }));
    const signature = await signMax(apiSecret, payload);

    const res = await fetch(`${MAX_BASE}${ACCOUNTS_PATH}?nonce=${nonce}`, {
        headers: {
            "X-MAX-ACCESSKEY": apiKey,
            "X-MAX-PAYLOAD": payload,
            "X-MAX-SIGNATURE": signature,
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) {
        const { detail, code, edgeBlocked } = await readError(res);
        // A non-API block (HTML challenge) means MAX's edge rejected this server's IP,
        // not the credentials — say so instead of blaming the key.
        if (edgeBlocked) {
            throw new ClientError(
                `MAX's Cloudflare edge blocked the request from this server (HTTP ${res.status}). MAX appears to reject requests from cloud/Worker IPs.`,
            );
        }
        // 2006 wrong signature, 2008 access key not found → bad credentials.
        if (code === 2006 || code === 2008) {
            throw new ClientError(
                `MAX rejected the credentials — check the API key and secret are valid and have read permission. ${detail}`,
            );
        }
        throw new ClientError(`MAX request failed: ${detail}`);
    }

    return await res.json() as MaxAccount[];
}

/** Fetch all market tickers (public) as a market-id → last-price map. */
async function fetchPriceMap(): Promise<Map<string, number>> {
    const res = await fetch(TICKERS_URL);
    if (!res.ok) {
        throw new ClientError(`Couldn't load MAX market prices: HTTP ${res.status}`);
    }
    const tickers = await res.json() as Record<string, MaxTicker>;
    const prices = new Map<string, number>();
    for (const [market, t] of Object.entries(tickers)) {
        const last = parseFloat(t.last);
        if (last > 0) prices.set(market, last);
    }
    return prices;
}

/**
 * Sum the MAX spot wallet (available + locked + staked per currency) valued in TWD.
 * MAX has no "total assets" endpoint, so each currency is priced via its market:
 * <coin>twd directly, else <coin>usdt × usdttwd. Currencies with no TWD/USDT
 * market are skipped (logged), since they can't be valued.
 */
export async function fetchMaxTotal(apiKey: string, apiSecret: string): Promise<ProviderBalance> {
    const [accounts, prices] = await Promise.all([
        fetchSpotAccounts(apiKey, apiSecret),
        fetchPriceMap(),
    ]);

    const usdtTwd = prices.get("usdttwd");
    let total = 0;
    const unpriced: string[] = [];

    for (const acc of accounts) {
        const amount = (parseFloat(acc.balance) || 0)
            + (parseFloat(acc.locked) || 0)
            + (parseFloat(acc.staked ?? "0") || 0);
        if (amount === 0) continue;

        const c = acc.currency.toLowerCase();
        if (c === "twd") {
            total += amount;
            continue;
        }
        const twdPrice = prices.get(`${c}twd`);
        if (twdPrice != null) {
            total += amount * twdPrice;
            continue;
        }
        const usdtPrice = prices.get(`${c}usdt`);
        if (usdtPrice != null && usdtTwd != null) {
            total += amount * usdtPrice * usdtTwd;
            continue;
        }
        unpriced.push(acc.currency);
    }

    if (unpriced.length > 0) {
        console.warn("fetchMaxTotal: no TWD/USDT market for", unpriced.join(", "));
    }

    return { total, currency: "TWD", fetchedAt: new Date().toISOString() };
}
