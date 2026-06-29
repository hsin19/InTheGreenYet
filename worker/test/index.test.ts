import {
    createExecutionContext,
    waitOnExecutionContext,
} from "cloudflare:test";
import {
    env,
    exports,
} from "cloudflare:workers";
import {
    describe,
    expect,
    it,
} from "vitest";
import worker from "../index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Hello World worker", () => {
    it("responds with Hello World! (unit style)", async () => {
        const request = new IncomingRequest("http://example.com/health");
        // Create an empty context to pass to `worker.fetch()`.
        const ctx = createExecutionContext();
        const response = await worker.fetch(request, env, ctx);
        // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
        await waitOnExecutionContext(ctx);
        expect(await response.text()).toMatchInlineSnapshot(`"{"status":"ok","service":"inthegreenyet"}"`);
    });

    it("responds with Hello World! (integration style)", async () => {
        const response = await exports.default.fetch("https://example.com/health");
        expect(await response.text()).toMatchInlineSnapshot(`"{"status":"ok","service":"inthegreenyet"}"`);
    });
});
