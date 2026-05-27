import { apiFetch } from "./api";
import type {
    BinanceBalance,
    BinanceBalanceRequest,
} from "./model";

/**
 * Fetch live total assets for a Binance account via the backend signing proxy.
 * Credentials are sent directly (the caller already holds them); no Notion token
 * is involved — this is independent of where the keys are stored.
 */
export async function fetchBinanceBalance(
    apiKey: string,
    apiSecret: string,
    currency: string,
): Promise<BinanceBalance> {
    const payload: BinanceBalanceRequest = { apiKey, apiSecret, currency };
    return apiFetch<BinanceBalance>("/api/binance/balance", null, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
