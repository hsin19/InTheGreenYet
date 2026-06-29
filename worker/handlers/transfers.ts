import {
    createTransfer,
    queryTransfers,
} from "../notion";
import {
    errorResponse,
    getToken,
    jsonResponse,
    parseJsonBody,
} from "../utils";

export async function handleGetTransfers(request: Request, _env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const transfers = await queryTransfers(token);
        return jsonResponse({ transfers }, 200);
    } catch (err) {
        console.error("handleGetTransfers error", err);
        return errorResponse(err);
    }
}

export async function handleCreateTransfer(request: Request, _env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const body = await parseJsonBody<Record<string, unknown>>(request);
        const id = await createTransfer(token, {
            title: (body.title as string) ?? "",
            amount: (body.amount as number | null) ?? null,
            currency: (body.currency as string | null) ?? null,
            fee: (body.fee as number | null) ?? null,
            exchangeRate: (body.exchangeRate as number | null) ?? null,
            date: (body.date as string | null) ?? null,
            from: (body.from as string) ?? "",
            to: (body.to as string) ?? "",
            note: (body.note as string) ?? "",
        });
        return jsonResponse({ id }, 201);
    } catch (err) {
        console.error("handleCreateTransfer error", err);
        return errorResponse(err);
    }
}
