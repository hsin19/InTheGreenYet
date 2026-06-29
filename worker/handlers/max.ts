import type { MaxBalanceRequest } from "../../shared/model";
import { fetchMaxTotal } from "../max";
import {
    ClientError,
    errorResponse,
    jsonResponse,
} from "../utils";

/**
 * Stateless signing proxy: the caller supplies MAX credentials, we sign and relay
 * the spot accounts call, then value every currency in TWD. No Notion token needed —
 * credential storage is handled separately by the config flow.
 */
export async function handleMaxBalance(request: Request, _url: URL, env: Env): Promise<Response> {
    try {
        const body = await request.json() as Partial<MaxBalanceRequest>;
        if (!body.apiKey || !body.apiSecret) {
            throw new ClientError("Missing apiKey/apiSecret");
        }

        const result = await fetchMaxTotal(body.apiKey, body.apiSecret);
        return jsonResponse(result, 200, env.FRONTEND_URL);
    } catch (err) {
        console.error("handleMaxBalance error:", err);
        return errorResponse(err, env.FRONTEND_URL);
    }
}
