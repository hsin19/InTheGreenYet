export class ClientError extends Error {}

export class DataSourceNotFoundError extends Error {
    constructor(name: string) {
        super(`Data source "${name}" not found`);
        this.name = "DataSourceNotFoundError";
    }
}

// Same-origin (the Worker serves the SPA and the API), so no CORS headers needed.
export function jsonResponse(data: unknown, status: number): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

export function errorResponse(err: unknown): Response {
    if (err instanceof DataSourceNotFoundError) {
        return jsonResponse({ error: "data_source_not_found" }, 404);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = err instanceof ClientError ? 400 : 500;
    return jsonResponse({ error: message }, status);
}

// Parse a JSON request body, mapping malformed JSON to a ClientError (→ 400)
// instead of letting the raw SyntaxError fall through to a 500.
export async function parseJsonBody<T>(request: Request): Promise<T> {
    try {
        return await request.json() as T;
    } catch {
        throw new ClientError("Invalid JSON body");
    }
}

export function getToken(request: Request): string {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) throw new ClientError("Missing Authorization header");
    return auth.slice(7);
}
