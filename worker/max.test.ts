import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { fetchMaxTotal } from "./max";
import { ClientError } from "./utils";

interface MaxResponses {
    accounts?: unknown;
    accountsStatus?: number;
    tickers?: unknown;
    tickersStatus?: number;
}

/**
 * fetchMaxTotal fires the accounts + tickers requests concurrently, so the mock
 * routes by URL and both interceptors must be supplied even when one path fails.
 */
function mockMax({ accounts = [], accountsStatus = 200, tickers = {}, tickersStatus = 200 }: MaxResponses) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
        const url = String(input);
        if (url.includes("/api/v3/wallet/spot/accounts")) {
            const body = typeof accounts === "string" ? accounts : JSON.stringify(accounts);
            return new Response(body, { status: accountsStatus });
        }
        if (url.includes("/api/v2/tickers")) {
            const body = typeof tickers === "string" ? tickers : JSON.stringify(tickers);
            return new Response(body, { status: tickersStatus });
        }
        throw new Error(`unexpected MAX url: ${url}`);
    });
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("fetchMaxTotal", () => {
    it("prices each currency via twd directly, usdt cross, and skips the unpriceable", async () => {
        mockMax({
            accounts: [
                { currency: "twd", balance: "500", locked: "300", staked: "200" }, // 1000 TWD direct
                { currency: "btc", balance: "0.01", locked: "0", staked: null }, // 0.01 * 3,000,000 = 30,000
                { currency: "eth", balance: "1", locked: "0", staked: null }, // 1 * 3000 * 32 = 96,000
                { currency: "doge", balance: "5", locked: "0", staked: null }, // no market → skipped
                { currency: "zero", balance: "0", locked: "0", staked: "0" }, // amount 0 → skipped
            ],
            tickers: {
                btctwd: { last: "3000000" },
                ethusdt: { last: "3000" },
                usdttwd: { last: "32" },
            },
        });

        const result = await fetchMaxTotal("key", "secret");

        expect(result.total).toBeCloseTo(127000);
        expect(result.currency).toBe("TWD");
    });

    it("surfaces a snippet when MAX serves a non-JSON challenge page", async () => {
        mockMax({
            accounts: "<html><title>Just a moment...</title>cloudflare cf-ray</html>",
            accountsStatus: 403,
        });

        const err = await fetchMaxTotal("key", "secret").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toMatch(/MAX request failed/);
        expect(err.message).toMatch(/Just a moment/i);
    });

    it("surfaces MAX's description field on a WAF block body", async () => {
        mockMax({
            accounts: JSON.stringify({
                incidentId: "0000000000000000",
                errorCode: "15",
                clientIp: "2001:db8::1",
                country: "TW",
                hostName: "max-api.maicoin.com",
                description: "waf block",
            }),
            accountsStatus: 403,
        });

        const err = await fetchMaxTotal("key", "secret").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toBe("MAX request failed: waf block");
    });

    it.each([2006, 2008])("throws a credential error for MAX code %s", async code => {
        mockMax({
            accounts: { error: { code, message: "rejected" } },
            accountsStatus: 401,
        });

        const err = await fetchMaxTotal("key", "secret").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toMatch(/rejected the credentials/);
    });

    it("throws a generic error for other account failures", async () => {
        mockMax({
            accounts: { error: { code: 9999, message: "server error" } },
            accountsStatus: 500,
        });

        const err = await fetchMaxTotal("key", "secret").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toBe("MAX request failed: server error (code 9999)");
    });

    it("throws when the ticker price feed is unavailable", async () => {
        mockMax({
            accounts: [{ currency: "twd", balance: "1", locked: "0", staked: null }],
            tickers: "boom",
            tickersStatus: 500,
        });

        const err = await fetchMaxTotal("key", "secret").catch(e => e);

        expect(err).toBeInstanceOf(ClientError);
        expect(err.message).toMatch(/Couldn't load MAX market prices/);
    });
});
