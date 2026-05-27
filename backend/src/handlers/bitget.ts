import { fetchBitgetTotal } from "../bitget";
import type { BitgetBalanceRequest } from "../model";
import {
    ClientError,
    errorResponse,
    jsonResponse,
} from "../utils";

/**
 * Stateless signing proxy: the caller supplies Bitget credentials, we sign and
 * relay the all-account-balance call. No Notion token needed — credential storage
 * is handled separately by the config flow.
 */
export async function handleBitgetBalance(request: Request, _url: URL, env: Env): Promise<Response> {
    try {
        const body = await request.json() as Partial<BitgetBalanceRequest>;
        if (!body.apiKey || !body.apiSecret || !body.passphrase) {
            throw new ClientError("Missing apiKey/apiSecret/passphrase");
        }

        const result = await fetchBitgetTotal(body.apiKey, body.apiSecret, body.passphrase);
        return jsonResponse(result, 200, env.FRONTEND_URL);
    } catch (err) {
        console.error("handleBitgetBalance error:", err);
        return errorResponse(err, env.FRONTEND_URL);
    }
}
