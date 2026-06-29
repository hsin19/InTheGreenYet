import type { CreateSnapshotInput } from "../../shared/model";
import {
    createSnapshots,
    querySnapshots,
} from "../notion";
import {
    errorResponse,
    getToken,
    jsonResponse,
} from "../utils";

export async function handleGetSnapshots(request: Request, _url: URL, _env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const rows = await querySnapshots(token);
        return jsonResponse({ data: rows }, 200);
    } catch (err) {
        console.error("handleGetSnapshots error:", err);
        return errorResponse(err);
    }
}

export async function handleCreateSnapshots(request: Request, _url: URL, _env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const payload = (await request.json()) as { snapshots: CreateSnapshotInput[]; };

        if (!payload.snapshots || !Array.isArray(payload.snapshots)) {
            return jsonResponse({ error: "Invalid payload, expected array of snapshots" }, 400);
        }

        const ids = await createSnapshots(token, payload.snapshots);
        return jsonResponse({ success: true, count: ids.length, ids }, 200);
    } catch (err) {
        console.error("handleCreateSnapshots error:", err);
        return errorResponse(err);
    }
}
