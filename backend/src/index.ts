import { handleOAuthCallback } from "./handlers/auth";
import {
    handleGetConfig,
    handleUpdateConfig,
} from "./handlers/config";
import { handleInit } from "./handlers/init";
import {
    handleCreateSnapshots,
    handleGetSnapshots,
} from "./handlers/snapshots";
import {
    handleCreateTransfer,
    handleGetTransfers,
} from "./handlers/transfers";
import {
    corsHeaders,
    jsonResponse,
} from "./utils";

export default {
    async fetch(request, env, _ctx): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(env.FRONTEND_URL) });
        }

        if (url.pathname === "/auth/notion/callback") {
            return handleOAuthCallback(request, url, env);
        }

        if (url.pathname === "/api/init" && request.method === "POST") {
            return handleInit(request, env);
        }

        if (url.pathname === "/api/transfers" && request.method === "GET") {
            return handleGetTransfers(request, env);
        }

        if (url.pathname === "/api/transfers" && request.method === "POST") {
            return handleCreateTransfer(request, env);
        }

        if (url.pathname === "/api/config" && request.method === "GET") {
            return handleGetConfig(request, url, env);
        }

        if (url.pathname === "/api/config" && request.method === "PUT") {
            return handleUpdateConfig(request, env);
        }

        if (url.pathname === "/api/snapshots" && request.method === "GET") {
            return handleGetSnapshots(request, url, env);
        }

        if (url.pathname === "/api/snapshots" && request.method === "POST") {
            return handleCreateSnapshots(request, url, env);
        }

        if (url.pathname === "/health") {
            return jsonResponse({ status: "ok", service: "inthegreen-backend" }, 200, env.FRONTEND_URL);
        }

        return new Response(null, { status: 404 });
    },
} satisfies ExportedHandler<Env>;
