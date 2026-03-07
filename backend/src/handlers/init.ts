import {
    createConfigDataSource,
    createSnapshotsDataSource,
    createTransferDataSource,
    findOrCreateDatabase,
    searchDataSource,
} from "../notion";
import {
    errorResponse,
    getToken,
    jsonResponse,
} from "../utils";

export async function handleInit(request: Request, env: Env): Promise<Response> {
    try {
        const token = getToken(request);

        const [transferDs, configDs, snapshotsDs] = await Promise.all([
            searchDataSource(token, "Transfer"),
            searchDataSource(token, "Config"),
            searchDataSource(token, "Snapshots"),
        ]);

        if (!transferDs || !configDs || !snapshotsDs) {
            const databaseId = await findOrCreateDatabase(token);
            await Promise.all([
                transferDs ? Promise.resolve() : createTransferDataSource(token, databaseId),
                configDs ? Promise.resolve() : createConfigDataSource(token, databaseId),
                snapshotsDs ? Promise.resolve() : createSnapshotsDataSource(token, databaseId),
            ]);
        }

        return jsonResponse({ ok: true }, 200, env.FRONTEND_URL);
    } catch (err) {
        console.error("Init failed", err);
        return errorResponse(err, env.FRONTEND_URL);
    }
}
