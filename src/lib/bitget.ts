import type {
    BitgetBalanceRequest,
    ProviderBalance,
} from "@shared/model";
import { apiFetch } from "./api";

/**
 * Fetch live total assets (in USDT) for a Bitget account via the backend signing
 * proxy. Credentials are sent directly (the caller already holds them); no Notion
 * token is involved — this is independent of where the keys are stored.
 */
export async function fetchBitgetBalance(
    apiKey: string,
    apiSecret: string,
    passphrase: string,
): Promise<ProviderBalance> {
    const payload: BitgetBalanceRequest = { apiKey, apiSecret, passphrase };
    return apiFetch<ProviderBalance>("/api/bitget/balance", null, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
