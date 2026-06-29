import type { ProviderBalance } from "../shared/model";
import type { Send } from "./relay";
import { ClientError } from "./utils";

const BINANCE_BASE = "https://api.binance.com";

interface WalletBalance {
    activate: boolean;
    balance: string;
    walletName: string;
}

interface BinanceError {
    code: number;
    msg: string;
}

async function signQuery(secret: string, query: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(query));
    return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fetch the total account assets across every Binance wallet (Spot, Funding,
 * Margin, Futures, Earn, ...) valued in the given quote asset. Uses the signed
 * wallet/balance endpoint, which quotes each wallet in the requested asset.
 */
export async function fetchBinanceTotal(
    apiKey: string,
    apiSecret: string,
    quoteAsset: string,
    send: Send = fetch,
): Promise<ProviderBalance> {
    const params = new URLSearchParams({
        quoteAsset,
        recvWindow: "10000",
        timestamp: String(Date.now()),
    });
    params.append("signature", await signQuery(apiSecret, params.toString()));

    const res = await send(`${BINANCE_BASE}/sapi/v1/asset/wallet/balance?${params.toString()}`, {
        headers: { "X-MBX-APIKEY": apiKey },
    });

    if (!res.ok) {
        const raw = await res.text();
        // Log the raw response so `wrangler tail` shows exactly what Binance returned.
        console.error(`Binance ${res.status} response:`, raw);
        let detail = `HTTP ${res.status}`;
        try {
            const body = JSON.parse(raw) as BinanceError;
            if (body?.msg) detail = `${body.msg} (code ${body.code})`;
        } catch {
            // non-JSON body (e.g. a CloudFront/edge block page). Prefer the page's
            // own <title> over a snippet of DOCTYPE boilerplate.
            const title = raw.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
            const text = title || raw.replace(/\s+/g, " ").trim().slice(0, 200);
            if (text) detail = `HTTP ${res.status}: ${text}`;
        }
        if (res.status === 401) {
            throw new ClientError(`Binance rejected the API key — check it is valid and has read permission. ${detail}`);
        }
        throw new ClientError(`Binance request failed: ${detail}`);
    }

    const wallets = await res.json() as WalletBalance[];
    const total = wallets.reduce((sum, w) => sum + (parseFloat(w.balance) || 0), 0);

    return { total, currency: quoteAsset, fetchedAt: new Date().toISOString() };
}
