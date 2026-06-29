import { apiFetch } from "./api";
import type {
    BinanceBalanceRequest,
    ProviderBalance,
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
): Promise<ProviderBalance> {
    const payload: BinanceBalanceRequest = { apiKey, apiSecret, currency };
    return apiFetch<ProviderBalance>("/api/binance/balance", null, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
