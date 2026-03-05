import { queryConfig } from "../notion";
import { ClientError, errorResponse, getToken, jsonResponse } from "../utils";

export async function handleGetConfig(request: Request, url: URL, env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const dataSourceId = url.searchParams.get("dataSourceId");
        if (!dataSourceId) throw new ClientError("Missing dataSourceId parameter");
        const key = url.searchParams.get("key") ?? undefined;
        const rows = await queryConfig(token, dataSourceId, key);
        return jsonResponse({ config: rows }, 200, env.FRONTEND_URL);
    } catch (err) {
        return errorResponse(err, env.FRONTEND_URL);
    }
}
