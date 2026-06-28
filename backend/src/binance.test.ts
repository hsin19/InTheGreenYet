import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { fetchBinanceTotal } from "./binance";
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

describe("fetchBinanceTotal", () => {
    it("sums the balance across every wallet", async () => {
        const fetchSpy = mockFetch([
            { activate: true, balance: "1.5", walletName: "Spot" },
            { activate: true, balance: "2.25", walletName: "Funding" },
            { activate: false, balance: "0", walletName: "Margin" },
        ]);

        const result = await fetchBinanceTotal("key", "secret", "USDT");

        expect(result.total).toBeCloseTo(3.75);
        expect(result.currency).toBe("USDT");
        expect(() => new Date(result.fetchedAt).toISOString()).not.toThrow();

        // Signs the query and sends the key header to the wallet/balance endpoint.
        const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("/sapi/v1/asset/wallet/balance");
        expect(url).toMatch(/signature=[0-9a-f]{64}/);
        expect((init.headers as Record<string, string>)["X-MBX-APIKEY"]).toBe("key");
    });

    it("treats non-numeric balances as zero", async () => {
        mockFetch([
            { activate: true, balance: "10", walletName: "Spot" },
            { activate: true, balance: "not-a-number", walletName: "Weird" },
        ]);

        const result = await fetchBinanceTotal("key", "secret", "USDT");

        expect(result.total).toBe(10);
    });

    it("throws a credential-specific ClientError on HTTP 401", async () => {
        mockFetch({ code: -2015, msg: "Invalid API-key" }, 401);

        const err = await fetchBinanceTotal("key", "secret", "USDT").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toMatch(/check it is valid/);
        expect(err.message).toMatch(/Invalid API-key \(code -2015\)/);
    });

    it("surfaces the API message for a non-401 JSON error", async () => {
        mockFetch({ code: -1003, msg: "Too many requests" }, 418);

        const err = await fetchBinanceTotal("key", "secret", "USDT").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toBe("Binance request failed: Too many requests (code -1003)");
    });

    it("surfaces a snippet of a non-JSON error body", async () => {
        mockFetch("<html>service unavailable</html>", 503);

        const err = await fetchBinanceTotal("key", "secret", "USDT").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toBe("Binance request failed: HTTP 503: <html>service unavailable</html>");
    });

    it("surfaces a snippet of a non-JSON HTTP 403 body", async () => {
        mockFetch("<html>403 Forbidden</html>", 403);

        const err = await fetchBinanceTotal("key", "secret", "USDT").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toBe("Binance request failed: HTTP 403: <html>403 Forbidden</html>");
    });
});
