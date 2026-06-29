import type { ProviderBalance } from "./model";
import type { Send } from "./relay";
import { ClientError } from "./utils";

const BITGET_BASE = "https://api.bitget.com";
const BALANCE_PATH = "/api/v2/account/all-account-balance";

interface BitgetResponse {
    code: string;
    msg: string;
    data: { accountType: string; usdtBalance: string; }[] | null;
}

/**
 * Bitget signs `timestamp + method + requestPath (+ query + body)` with HMAC-SHA256
 * and base64-encodes the digest — unlike Binance's hex-encoded query signature.
 */
async function signBitget(secret: string, prehash: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(prehash));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Fetch the total account assets across every Bitget account type (Spot, Futures,
 * Funding, Earn, Bots, Margin, ...) valued in USDT. The all-account-balance endpoint
 * already quotes every wallet in USDT, so there is no quote-asset parameter.
 */
export async function fetchBitgetTotal(
    apiKey: string,
    apiSecret: string,
    passphrase: string,
    send: Send = fetch,
): Promise<ProviderBalance> {
    const ts = String(Date.now());
    // This endpoint takes no query/body, so the prehash is just timestamp + method + path.
    const prehash = ts + "GET" + BALANCE_PATH;
    const sign = await signBitget(apiSecret, prehash);

    const res = await send(`${BITGET_BASE}${BALANCE_PATH}`, {
        headers: {
            "ACCESS-KEY": apiKey,
            "ACCESS-SIGN": sign,
            "ACCESS-TIMESTAMP": ts,
            "ACCESS-PASSPHRASE": passphrase,
            "Content-Type": "application/json",
            "locale": "en-US",
        },
    });

    // Bitget signals failures both via non-2xx status and via a non-"00000" code in
    // the body, so parse the body either way and key off the code.
    const body = await res.json().catch(() => null) as BitgetResponse | null;

    if (!res.ok || !body || body.code !== "00000") {
        const detail = body?.code ? `${body.msg || "request rejected"} (code ${body.code})` : `HTTP ${res.status}`;
        // 40009 sign error, 40011/40012 apikey/passphrase incorrect, 40037 apikey not exist.
        if (body && ["40009", "40011", "40012", "40037"].includes(body.code)) {
            throw new ClientError(
                `Bitget rejected the credentials — check the API key, secret and passphrase are valid and have read permission. ${detail}`,
            );
        }
        // 40018 IP not in whitelist.
        if (body?.code === "40018") {
            throw new ClientError(
                `Bitget rejected the request IP — leave IP access unrestricted (this app runs on Cloudflare's rotating IPs). ${detail}`,
            );
        }
        throw new ClientError(`Bitget request failed: ${detail}`);
    }

    const total = (body.data ?? []).reduce((sum, a) => sum + (parseFloat(a.usdtBalance) || 0), 0);

    return { total, currency: "USDT", fetchedAt: new Date().toISOString() };
}
