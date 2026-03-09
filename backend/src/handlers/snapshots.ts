import {
    CreateSnapshotInput,
    createSnapshots,
    querySnapshots,
} from "../notion";
import {
    errorResponse,
    getToken,
    jsonResponse,
} from "../utils";

export async function handleGetSnapshots(request: Request, _url: URL, env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const rows = await querySnapshots(token);
        return jsonResponse({ data: rows }, 200, env.FRONTEND_URL);
    } catch (err) {
        console.error("handleGetSnapshots error:", err);
        return errorResponse(err, env.FRONTEND_URL);
    }
}

export async function handleCreateSnapshots(request: Request, _url: URL, env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const payload = (await request.json()) as { snapshots: CreateSnapshotInput[]; };

        if (!payload.snapshots || !Array.isArray(payload.snapshots)) {
            return jsonResponse({ error: "Invalid payload, expected array of snapshots" }, 400, env.FRONTEND_URL);
        }

        const ids = await createSnapshots(token, payload.snapshots);
        return jsonResponse({ success: true, count: ids.length, ids }, 200, env.FRONTEND_URL);
    } catch (err) {
        console.error("handleCreateSnapshots error:", err);
        return errorResponse(err, env.FRONTEND_URL);
    }
}
