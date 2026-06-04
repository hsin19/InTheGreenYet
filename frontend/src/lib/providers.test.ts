import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { fetchBinanceBalance } from "./binance";
import { fetchBitgetBalance } from "./bitget";
import { fetchMaxBalance } from "./max";
import type { ProviderBalance } from "./model";

const BALANCE: ProviderBalance = { total: 42, currency: "USDT", fetchedAt: "2026-06-05T00:00:00Z" };

function mockFetch(): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(BALANCE), { status: 200 }),
    );
}

function sentBody(spy: ReturnType<typeof vi.spyOn>): unknown {
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string);
}

// VITE_API_BASE_URL may prefix the path (empty in prod, a host in dev), so match
// the endpoint by suffix rather than an exact URL.
function calledPath(spy: ReturnType<typeof vi.spyOn>): string {
    return (spy.mock.calls[0] as [string, RequestInit])[0];
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("provider balance clients", () => {
    it("posts Binance credentials to the signing proxy", async () => {
        const spy = mockFetch();

        const result = await fetchBinanceBalance("k", "s", "USDT");

        expect(result).toEqual(BALANCE);
        expect(calledPath(spy)).toMatch(/\/api\/binance\/balance$/);
        expect(sentBody(spy)).toEqual({ apiKey: "k", apiSecret: "s", currency: "USDT" });
    });

    it("posts Bitget credentials (with passphrase) to the signing proxy", async () => {
        const spy = mockFetch();

        const result = await fetchBitgetBalance("k", "s", "pass");

        expect(result).toEqual(BALANCE);
        expect(calledPath(spy)).toMatch(/\/api\/bitget\/balance$/);
        expect(sentBody(spy)).toEqual({ apiKey: "k", apiSecret: "s", passphrase: "pass" });
    });

    it("posts MAX credentials to the signing proxy", async () => {
        const spy = mockFetch();

        const result = await fetchMaxBalance("k", "s");

        expect(result).toEqual(BALANCE);
        expect(calledPath(spy)).toMatch(/\/api\/max\/balance$/);
        expect(sentBody(spy)).toEqual({ apiKey: "k", apiSecret: "s" });
    });
});
