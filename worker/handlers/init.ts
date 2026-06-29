import {
    createConfigDataSource,
    createSnapshotsDataSource,
    createTransferDataSource,
    findOrCreateDatabase,
    searchDataSource,
    waitForDataSource,
} from "../notion";
import {
    errorResponse,
    getToken,
    jsonResponse,
} from "../utils";

export async function handleInit(request: Request, _env: Env): Promise<Response> {
    try {
        const token = getToken(request);

        const [transferDs, configDs, snapshotsDs] = await Promise.all([
            searchDataSource(token, "Transfer"),
            searchDataSource(token, "Config"),
            searchDataSource(token, "Snapshots"),
        ]);

        const needCreate = !transferDs || !configDs || !snapshotsDs;
        if (needCreate) {
            const databaseId = await findOrCreateDatabase(token);
            await Promise.all([
                transferDs ? Promise.resolve() : createTransferDataSource(token, databaseId),
                configDs ? Promise.resolve() : createConfigDataSource(token, databaseId),
                snapshotsDs ? Promise.resolve() : createSnapshotsDataSource(token, databaseId),
            ]);

            // Notion's search has eventual consistency — block until each newly
            // created data source becomes searchable, so the next query won't 404.
            await Promise.all([
                transferDs ? Promise.resolve() : waitForDataSource(token, "Transfer"),
                configDs ? Promise.resolve() : waitForDataSource(token, "Config"),
                snapshotsDs ? Promise.resolve() : waitForDataSource(token, "Snapshots"),
            ]);
        }

        return jsonResponse({ ok: true }, 200);
    } catch (err) {
        console.error("handleInit error", err);
        return errorResponse(err);
    }
}
