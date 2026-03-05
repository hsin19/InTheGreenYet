import { createConfigDataSource, createTransferDataSource, searchDataSource } from "../notion";
import { errorResponse, getToken, jsonResponse } from "../utils";

export async function handleSetup(request: Request, env: Env): Promise<Response> {
    try {
        const token = getToken(request);

        const [existingTransfer, existingConfig] = await Promise.all([
            searchDataSource(token, "Transfer"),
            searchDataSource(token, "Config"),
        ]);

        const [transferResult, configResult] = await Promise.all([
            existingTransfer
                ? { dataSourceId: existingTransfer.id }
                : createTransferDataSource(token),
            existingConfig
                ? { dataSourceId: existingConfig.id }
                : createConfigDataSource(token).then(id => ({ dataSourceId: id })),
        ]);

        const created = !existingTransfer || !existingConfig;
        return jsonResponse({
            transferDataSourceId: transferResult.dataSourceId,
            configDataSourceId: configResult.dataSourceId,
            created,
        }, 200, env.FRONTEND_URL);
    } catch (err) {
        return errorResponse(err, env.FRONTEND_URL);
    }
}
