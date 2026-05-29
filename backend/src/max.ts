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

    // MAX wraps failures in { success: false, error: { code, message } } and keys
    // the cause off the code, so parse the body regardless of the HTTP status.
    if (!res.ok) {
        const body = await res.json().catch(() => null) as MaxErrorBody | null;
        const err = body?.error;
        const detail = err ? `${err.message} (code ${err.code})` : `HTTP ${res.status}`;
        // 2006 wrong signature, 2008 access key not found → bad credentials.
        if (err && (err.code === 2006 || err.code === 2008)) {
            throw new ClientError(
                `MAX rejected the credentials — check the API key and secret are valid and have read permission. ${detail}`,
            );
        }
        // Read permission missing / IP not allowed surface as authorization failures.
        if (res.status === 403) {
            throw new ClientError(
                `MAX rejected the request — give the key read access and leave its IP restriction empty (this app runs on Cloudflare's rotating IPs). ${detail}`,
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
