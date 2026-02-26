import {
    createTransactionDataSource,
    searchDataSource,
} from "./notion";

export default {
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);
        const origin = getFrontendOrigin(request, url, env);

        // --- CORS preflight ---
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        // --- OAuth callback (redirect, no CORS needed) ---
        if (url.pathname === "/auth/notion/callback") {
            return handleOAuthCallback(request, url, env, origin);
        }

        // --- Setup: find or create Transaction data source ---
        if (url.pathname === "/api/setup" && request.method === "POST") {
            return handleSetup(request, env, origin);
        }

        // --- Health check ---
        return jsonResponse({ status: "ok", service: "inthegreen-proxy" }, 200, origin);
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

function getToken(request: Request): string {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
        throw new Error("Missing Authorization header");
    }
    return auth.slice(7);
}

/**
 * Determine the frontend origin for CORS and redirects.
 * Priority: FRONTEND_URL env > X-Forwarded-Host header (Vite proxy) > url.origin
 */
function getFrontendOrigin(request: Request, url: URL, env: Env): string {
    if (env.FRONTEND_URL) return env.FRONTEND_URL;
    const fwdHost = request.headers.get("X-Forwarded-Host");
    if (fwdHost) {
        const proto = request.headers.get("X-Forwarded-Proto") ?? "https";
        return `${proto}://${fwdHost}`;
    }
    return url.origin;
}

// ─── Setup handler ────────────────────────────────────────────

async function handleSetup(request: Request, env: Env, origin: string): Promise<Response> {
    try {
        const token = getToken(request);

        // 1. Search for existing Transaction data source
        const existing = await searchDataSource(token, "Transaction");
        if (existing) {
            return jsonResponse({ transactionDataSourceId: existing.id, created: false }, 200, origin);
        }

        // 2. Not found → create database + data source
        const result = await createTransactionDataSource(token);
        return jsonResponse({ transactionDataSourceId: result.dataSourceId, created: true }, 200, origin);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return jsonResponse({ error: message }, 400, origin);
    }
}

// ─── OAuth callback handler ───────────────────────────────────

async function handleOAuthCallback(request: Request, url: URL, env: Env, origin: string): Promise<Response> {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    // User denied access on Notion side
    if (error) {
        const target = new URL("/", origin);
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
        const target = new URL("/", origin);
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
    const callbackUrl = new URL("/callback", origin);
    callbackUrl.searchParams.set("access_token", data.access_token);
    if (data.workspace_name) {
        callbackUrl.searchParams.set("workspace_name", data.workspace_name);
    }
    if (data.workspace_id) {
        callbackUrl.searchParams.set("workspace_id", data.workspace_id);
    }

    return Response.redirect(callbackUrl.toString(), 302);
}
