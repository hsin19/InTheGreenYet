import type { BinanceBalanceRequest } from "../../shared/model";
import { fetchBinanceTotal } from "../binance";
import {
    ClientError,
    errorResponse,
    jsonResponse,
} from "../utils";

/**
 * Stateless signing proxy: the caller supplies Binance credentials, we sign and
 * relay the wallet/balance call. No Notion token needed — credential storage is
 * handled separately by the config flow.
 */
export async function handleBinanceBalance(request: Request, _url: URL, _env: Env): Promise<Response> {
    try {
        const body = await request.json() as Partial<BinanceBalanceRequest>;
        if (!body.apiKey || !body.apiSecret) {
            throw new ClientError("Missing apiKey/apiSecret");
        }

        const quoteAsset = (body.currency || "USDT").toUpperCase();
        const result = await fetchBinanceTotal(body.apiKey, body.apiSecret, quoteAsset);
        return jsonResponse(result, 200);
    } catch (err) {
        console.error("handleBinanceBalance error:", err);
        return errorResponse(err);
    }
}
