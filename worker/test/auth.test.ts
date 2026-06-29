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
import worker from "../index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function dispatch(path: string, init?: RequestInit<IncomingRequestCfProperties>): Promise<Response> {
    const request = new IncomingRequest(`https://example.com${path}`, init);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    return response;
}

// These branches never call the live Notion token endpoint, so they exercise the
// migration's url.origin redirect derivation (replacing the removed FRONTEND_URL)
// and the method guard without any network mocking.
describe("OAuth callback (/auth/notion/callback)", () => {
    it("redirects ?error to /landing on the request origin", async () => {
        const res = await dispatch("/auth/notion/callback?error=access_denied");

        expect(res.status).toBe(302);
        expect(res.headers.get("Location")).toBe("https://example.com/landing?error=access_denied");
    });

    it("returns 400 when neither code nor error is present", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const res = await dispatch("/auth/notion/callback");

        expect(res.status).toBe(400);
        const body = await res.json() as { error: string; };
        expect(body.error).toMatch(/Missing code/);
        vi.restoreAllMocks();
    });

    it("does not run the callback for non-GET methods (falls through to 404)", async () => {
        const res = await dispatch("/auth/notion/callback?code=x", { method: "POST" });
        expect(res.status).toBe(404);
    });
});
