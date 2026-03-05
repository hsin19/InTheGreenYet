import {
    createTransferDataSource,
    queryTransfers,
    searchDataSource,
} from "./notion";

export default {
    async fetch(request, env, _ctx): Promise<Response> {
        const url = new URL(request.url);

        // --- CORS preflight ---
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(env.FRONTEND_URL) });
        }

        // --- OAuth callback (redirect, no CORS needed) ---
        if (url.pathname === "/auth/notion/callback") {
            return handleOAuthCallback(request, url, env);
        }

        // --- Setup: find or create Transaction data source ---
        if (url.pathname === "/api/setup" && request.method === "POST") {
            return handleSetup(request, env);
        }

        // --- Get transfers ---
        if (url.pathname === "/api/transfers" && request.method === "GET") {
            return handleGetTransfers(request, url, env);
        }

        // --- Health check ---
        if (url.pathname === "/health") {
            return jsonResponse({ status: "ok", service: "inthegreen-backend" }, 200, env.FRONTEND_URL);
        }

        return new Response(null, { status: 404 });
    },
} satisfies ExportedHandler<Env>;

// ─── CORS helpers ─────────────────────────────────────────────

function corsHeaders(origin: string): Record<string, string> {
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}

function jsonResponse(data: unknown, status: number, origin: string): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
        },
    });
}

// ─── Helpers ──────────────────────────────────────────────────

class ClientError extends Error {}

function getToken(request: Request): string {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
        throw new ClientError("Missing Authorization header");
    }
    return auth.slice(7);
}

function errorResponse(err: unknown, origin: string): Response {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = err instanceof ClientError ? 400 : 500;
    return jsonResponse({ error: message }, status, origin);
}

// ─── Setup handler ────────────────────────────────────────────

async function handleSetup(request: Request, env: Env): Promise<Response> {
    try {
        const token = getToken(request);

        // 1. Search for existing Transfer data source
        const existing = await searchDataSource(token, "Transfer");
        if (existing) {
            return jsonResponse({ transferDataSourceId: existing.id, created: false }, 200, env.FRONTEND_URL);
        }

        // 2. Not found → create database + data source
        const result = await createTransferDataSource(token);
        return jsonResponse({ transferDataSourceId: result.dataSourceId, created: true }, 200, env.FRONTEND_URL);
    } catch (err) {
        return errorResponse(err, env.FRONTEND_URL);
    }
}

// ─── Get transfers handler ─────────────────────────────────────

async function handleGetTransfers(request: Request, url: URL, env: Env): Promise<Response> {
    try {
        const token = getToken(request);
        const dataSourceId = url.searchParams.get("dataSourceId");
        if (!dataSourceId) {
            throw new ClientError("Missing dataSourceId parameter");
        }
        const transfers = await queryTransfers(token, dataSourceId);
        return jsonResponse({ transfers }, 200, env.FRONTEND_URL);
    } catch (err) {
        return errorResponse(err, env.FRONTEND_URL);
    }
}

// ─── OAuth callback handler ───────────────────────────────────

async function handleOAuthCallback(request: Request, url: URL, env: Env): Promise<Response> {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    // User denied access on Notion side
    if (error) {
        const target = new URL("/", env.FRONTEND_URL);
        target.searchParams.set("error", error);
        return Response.redirect(target.toString(), 302);
    }

    if (!code) {
        return Response.json({ error: "Missing code parameter" }, { status: 400 });
    }

    // Exchange authorization code for access token
    const encoded = btoa(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`);

    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Basic ${encoded}`,
        },
        body: JSON.stringify({
            grant_type: "authorization_code",
            code,
            redirect_uri: `${url.origin}/auth/notion/callback`,
        }),
    });

    if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error("Token exchange failed:", errBody);
        const target = new URL("/", env.FRONTEND_URL);
        target.searchParams.set("error", "token_exchange_failed");
        return Response.redirect(target.toString(), 302);
    }

    const data = (await tokenRes.json()) as {
        access_token: string;
        workspace_name?: string;
        workspace_id?: string;
        bot_id?: string;
    };

    // Redirect back to frontend /callback with token info
    const callbackUrl = new URL("/callback", env.FRONTEND_URL);
    callbackUrl.searchParams.set("access_token", data.access_token);
    if (data.workspace_name) {
        callbackUrl.searchParams.set("workspace_name", data.workspace_name);
    }
    if (data.workspace_id) {
        callbackUrl.searchParams.set("workspace_id", data.workspace_id);
    }

    return Response.redirect(callbackUrl.toString(), 302);
}
