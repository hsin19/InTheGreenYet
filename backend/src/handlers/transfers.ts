import { createTransfer, queryTransfers } from "../notion";
import { errorResponse, getToken, jsonResponse } from "../utils";

export async function handleGetTransfers(request: Request, env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const transfers = await queryTransfers(token);
        return jsonResponse({ transfers }, 200, env.FRONTEND_URL);
    } catch (err) {
        return errorResponse(err, env.FRONTEND_URL);
    }
}

export async function handleCreateTransfer(request: Request, env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const body = await request.json() as Record<string, unknown>;
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
        return jsonResponse({ id }, 201, env.FRONTEND_URL);
    } catch (err) {
        return errorResponse(err, env.FRONTEND_URL);
    }
}
