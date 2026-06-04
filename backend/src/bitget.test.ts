import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { fetchBitgetTotal } from "./bitget";
import { ClientError } from "./utils";

function mockFetch(body: unknown, status = 200): ReturnType<typeof vi.spyOn> {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(payload, { status }));
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("fetchBitgetTotal", () => {
    it("sums the USDT balance across every account type", async () => {
        const fetchSpy = mockFetch({
            code: "00000",
            msg: "success",
            data: [
                { accountType: "spot", usdtBalance: "10.5" },
                { accountType: "futures", usdtBalance: "5.25" },
            ],
        });

        const result = await fetchBitgetTotal("key", "secret", "pass");

        expect(result.total).toBeCloseTo(15.75);
        expect(result.currency).toBe("USDT");

        // Sends the four ACCESS-* headers required by Bitget.
        const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers["ACCESS-KEY"]).toBe("key");
        expect(headers["ACCESS-PASSPHRASE"]).toBe("pass");
        expect(headers["ACCESS-SIGN"]).toBeTruthy();
        expect(headers["ACCESS-TIMESTAMP"]).toBeTruthy();
    });

    it("returns zero when the data array is null", async () => {
        mockFetch({ code: "00000", msg: "success", data: null });

        const result = await fetchBitgetTotal("key", "secret", "pass");

        expect(result.total).toBe(0);
    });

    it.each(["40009", "40011", "40012", "40037"])(
        "throws a credential error for code %s",
        async code => {
            mockFetch({ code, msg: "bad credentials", data: null });

            const err = await fetchBitgetTotal("key", "secret", "pass").catch(e => e);

            expect(err).toBeInstanceOf(ClientError);
            expect(err.message).toMatch(/check the API key, secret and passphrase/);
        },
    );

    it("throws an IP-whitelist error for code 40018", async () => {
        mockFetch({ code: "40018", msg: "ip not allowed", data: null });

        const err = await fetchBitgetTotal("key", "secret", "pass").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toMatch(/rejected the request IP/);
    });

    it("throws a generic error for other non-zero codes", async () => {
        mockFetch({ code: "50001", msg: "server busy", data: null });

        const err = await fetchBitgetTotal("key", "secret", "pass").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toBe("Bitget request failed: server busy (code 50001)");
    });

    it("falls back to the HTTP status when the body is not JSON", async () => {
        mockFetch("<html>bad gateway</html>", 502);

        const err = await fetchBitgetTotal("key", "secret", "pass").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toBe("Bitget request failed: HTTP 502");
    });
});
