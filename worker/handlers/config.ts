import {
    queryConfig,
    updateConfig,
} from "../notion";
import {
    ClientError,
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
        console.error("handleGetConfig error", err);
        return errorResponse(err, env.FRONTEND_URL);
    }
}

export async function handleUpdateConfig(request: Request, env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const body = await request.json() as { key?: string; value?: unknown; };
        if (!body.key || typeof body.key !== "string") {
            throw new ClientError("Missing or invalid field: key");
        }
        if (!("value" in body)) {
            throw new ClientError("Missing field: value");
        }
        await updateConfig(token, body.key, body.value);
        return jsonResponse({ ok: true }, 200, env.FRONTEND_URL);
    } catch (err) {
        console.error("handleUpdateConfig error", err);
        return errorResponse(err, env.FRONTEND_URL);
    }
}
