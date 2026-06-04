import {
    createExecutionContext,
    waitOnExecutionContext,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import {
    describe,
    expect,
    it,
    vi,
} from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function dispatch(path: string, init?: RequestInit<IncomingRequestCfProperties>): Promise<Response> {
    const request = new IncomingRequest(`https://example.com${path}`, init);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    return response;
}

describe("worker routing", () => {
    it("answers CORS preflight with 204 and the allow-origin header", async () => {
        const res = await dispatch("/api/transfers", { method: "OPTIONS" });

        expect(res.status).toBe(204);
        expect(res.headers.has("Access-Control-Allow-Origin")).toBe(true);
        expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });

    it("returns 404 for an unknown path", async () => {
        const res = await dispatch("/api/does-not-exist");
        expect(res.status).toBe(404);
    });

    it("returns 404 when the method does not match a known route", async () => {
        // /api/transfers exists for GET and POST, but not DELETE.
        const res = await dispatch("/api/transfers", { method: "DELETE" });
        expect(res.status).toBe(404);
    });

    it("routes POST /api/binance/balance to its handler and validates input", async () => {
        // Missing credentials short-circuit before any outbound call, so this
        // exercises the route + handler without hitting Binance.
        vi.spyOn(console, "error").mockImplementation(() => {});
        const res = await dispatch("/api/binance/balance", {
            method: "POST",
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(400);
        const body = await res.json() as { error: string; };
        expect(body.error).toMatch(/Missing apiKey/);
        vi.restoreAllMocks();
    });
});
