import { handleOAuthCallback } from "./handlers/auth";
import { handleBinanceBalance } from "./handlers/binance";
import { handleBitgetBalance } from "./handlers/bitget";
import {
    handleGetConfig,
    handleGetPublicConfig,
    handleUpdateConfig,
} from "./handlers/config";
import { handleInit } from "./handlers/init";
import { handleMaxBalance } from "./handlers/max";
import {
    handleCreateSnapshots,
    handleGetSnapshots,
} from "./handlers/snapshots";
import {
    handleCreateTransfer,
    handleGetTransfers,
} from "./handlers/transfers";
import { configureNotion } from "./notion";
import { jsonResponse } from "./utils";

export default {
    async fetch(request, env, _ctx): Promise<Response> {
        configureNotion(env.NOTION_API_BASE_URL);
        const url = new URL(request.url);

        if (url.pathname === "/auth/notion/callback" && request.method === "GET") {
            return handleOAuthCallback(request, url, env);
        }

        if (url.pathname === "/api/public-config" && request.method === "GET") {
            return handleGetPublicConfig(request, env);
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

        if (url.pathname === "/api/binance/balance" && request.method === "POST") {
            return handleBinanceBalance(request, url, env);
        }

        if (url.pathname === "/api/bitget/balance" && request.method === "POST") {
            return handleBitgetBalance(request, url, env);
        }

        if (url.pathname === "/api/max/balance" && request.method === "POST") {
            return handleMaxBalance(request, url, env);
        }

        if (url.pathname === "/health") {
            return jsonResponse({ status: "ok", service: "inthegreenyet" }, 200);
        }

        return new Response(null, { status: 404 });
    },
} satisfies ExportedHandler<Env>;
