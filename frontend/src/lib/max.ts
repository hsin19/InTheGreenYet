import { apiFetch } from "./api";
import type {
    MaxBalanceRequest,
    ProviderBalance,
} from "./model";

/**
 * Fetch live total assets (valued in TWD) for a MAX account via the backend signing
 * proxy. Credentials are sent directly (the caller already holds them); no Notion
 * token is involved — this is independent of where the keys are stored.
 */
export async function fetchMaxBalance(
    apiKey: string,
    apiSecret: string,
): Promise<ProviderBalance> {
    const payload: MaxBalanceRequest = { apiKey, apiSecret };
    return apiFetch<ProviderBalance>("/api/max/balance", null, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
