export class ClientError extends Error {}

export class DataSourceNotFoundError extends Error {
    constructor(name: string) {
        super(`Data source "${name}" not found`);
        this.name = "DataSourceNotFoundError";
    }
}

export function corsHeaders(origin: string): Record<string, string> {
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}

export function jsonResponse(data: unknown, status: number, origin: string): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
}

export function errorResponse(err: unknown, origin: string): Response {
    if (err instanceof DataSourceNotFoundError) {
        return jsonResponse({ error: "data_source_not_found" }, 404, origin);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = err instanceof ClientError ? 400 : 500;
    return jsonResponse({ error: message }, status, origin);
}

export function getToken(request: Request): string {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) throw new ClientError("Missing Authorization header");
    return auth.slice(7);
}
