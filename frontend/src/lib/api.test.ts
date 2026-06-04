import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    apiFetch,
    DataSourceNotFoundError,
} from "./api";

function mockFetch(body: unknown, status = 200): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(body), { status }),
    );
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("apiFetch", () => {
    it("returns the parsed JSON body on success", async () => {
        mockFetch({ foo: 1 });

        await expect(apiFetch("/api/x")).resolves.toEqual({ foo: 1 });
    });

    it("attaches the bearer token and JSON content-type when a body is sent", async () => {
        const spy = mockFetch({ ok: true });

        await apiFetch("/api/x", "tok", { method: "POST", body: JSON.stringify({ a: 1 }) });

        const [, init] = spy.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer tok");
        expect(headers["Content-Type"]).toBe("application/json");
    });

    it("omits the auth header when no token is given", async () => {
        const spy = mockFetch({});

        await apiFetch("/api/x");

        const [, init] = spy.mock.calls[0] as [string, RequestInit];
        expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    });

    it("throws DataSourceNotFoundError on a 404 data_source_not_found", async () => {
        mockFetch({ error: "data_source_not_found" }, 404);

        await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(DataSourceNotFoundError);
    });

    it("throws the server-provided error message on failure", async () => {
        mockFetch({ error: "boom" }, 500);

        await expect(apiFetch("/api/x")).rejects.toThrow("boom");
    });

    it("falls back to a status message when the error body has no error field", async () => {
        mockFetch({}, 500);

        await expect(apiFetch("/api/x")).rejects.toThrow("Request failed: 500");
    });
});
