import { queryConfig } from "../notion";
import {
    errorResponse,
    getToken,
    jsonResponse,
} from "../utils";

export async function handleGetConfig(request: Request, url: URL, env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const key = url.searchParams.get("key") ?? undefined;
        const rows = await queryConfig(token, key);
        return jsonResponse({ config: rows }, 200, env.FRONTEND_URL);
    } catch (err) {
        return errorResponse(err, env.FRONTEND_URL);
    }
}
