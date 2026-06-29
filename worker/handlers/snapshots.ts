import type { CreateSnapshotInput } from "../../shared/model";
import {
    createSnapshots,
    querySnapshots,
} from "../notion";
import {
    ClientError,
    errorResponse,
    getToken,
    jsonResponse,
    parseJsonBody,
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

function validateSnapshot(s: unknown): CreateSnapshotInput {
    const obj = (s ?? {}) as Record<string, unknown>;
    if (
        typeof obj.account !== "string" || typeof obj.date !== "string"
        || typeof obj.amount !== "number" || typeof obj.currency !== "string"
    ) {
        throw new ClientError("Invalid snapshot: account/currency/date must be strings and amount a number");
    }
    return { account: obj.account, date: obj.date, amount: obj.amount, currency: obj.currency };
}

export async function handleCreateSnapshots(request: Request, _url: URL, _env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const payload = await parseJsonBody<{ snapshots?: unknown; }>(request);

        if (!Array.isArray(payload.snapshots)) {
            throw new ClientError("Invalid payload, expected array of snapshots");
        }
        const snapshots = payload.snapshots.map(validateSnapshot);

        const ids = await createSnapshots(token, snapshots);
        return jsonResponse({ success: true, count: ids.length, ids }, 200);
    } catch (err) {
        console.error("handleCreateSnapshots error:", err);
        return errorResponse(err);
    }
}
