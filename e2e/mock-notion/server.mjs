// Minimal mock of the Notion REST API for e2e smoke tests.
//
// The real `wrangler dev` Worker is pointed here via NOTION_API_BASE_URL, so the
// full browser → Worker → Notion path is exercised without touching real Notion
// or needing any secret. Responses are structurally valid but intentionally
// minimal: enough that the Worker's notion.ts helpers don't throw and the SPA
// renders empty states. Response shapes mirror worker/test/notion.test.ts.
//
// Run: node e2e/mock-notion/server.mjs   (PORT env overrides the default 8888)

import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? process.env.MOCK_NOTION_PORT ?? 8888);

// The three data sources the SPA provisions/reads on load. Search returns all of
// them regardless of query; the Worker's searchDataSource filters by exact title.
const DATA_SOURCES = [
    dataSource("ds-transfer", "Transfer"),
    dataSource("ds-config", "Config"),
    dataSource("ds-snapshots", "Snapshots"),
];

function dataSource(id, title) {
    return { object: "data_source", id, title: [{ plain_text: title }] };
}

function readBody(req) {
    return new Promise(resolve => {
        let raw = "";
        req.on("data", chunk => raw += chunk);
        req.on("end", () => resolve(raw));
    });
}

function route(method, path) {
    // POST /v1/search → return all known data sources.
    if (method === "POST" && path === "/v1/search") {
        return { results: DATA_SOURCES, has_more: false };
    }
    // POST /v1/data_sources/{id}/query → empty result set (smoke renders empty).
    if (method === "POST" && /^\/v1\/data_sources\/[^/]+\/query$/.test(path)) {
        return { results: [], has_more: false };
    }
    // POST /v1/oauth/token → fake token (unused by smoke; ready for callback tests).
    if (method === "POST" && path === "/v1/oauth/token") {
        return {
            access_token: "mock-access-token",
            workspace_id: "mock-workspace",
            workspace_name: "Mock Workspace",
            bot_id: "mock-bot",
        };
    }
    // Writes (pages/databases/data_sources): acknowledge so nothing throws.
    if (method === "POST" && (path === "/v1/pages" || path === "/v1/databases" || path === "/v1/data_sources")) {
        return { id: "mock-created" };
    }
    if (method === "PATCH" && /^\/v1\/pages\/[^/]+$/.test(path)) {
        return { id: "mock-updated" };
    }
    return null;
}

const server = createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const path = new URL(req.url ?? "/", `http://localhost:${PORT}`).pathname;

    if (method === "GET" && path === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
    }

    await readBody(req);
    const body = route(method, path);

    if (body === null) {
        console.warn(`[mock-notion] unhandled ${method} ${path}`);
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ object: "error", status: 404, code: "object_not_found", message: "mock: unhandled route" }));
        return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
});

server.listen(PORT, () => {
    console.log(`[mock-notion] listening on http://localhost:${PORT}`);
});
