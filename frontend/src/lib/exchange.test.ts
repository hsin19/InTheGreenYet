import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    type ExchangeRates,
    loadExchangeRates,
} from "./exchange";

// Mock localStorage for Node environment
const mockStore: Record<string, string> = {};
const mockLocalStorage = {
    getItem: (key: string) => mockStore[key] || null,
    setItem: (key: string, value: string) => {
        mockStore[key] = value;
    },
    removeItem: (key: string) => {
        delete mockStore[key];
    },
    clear: () => {
        for (const key in mockStore) {
            delete mockStore[key];
        }
    },
};

Object.defineProperty(globalThis, "localStorage", {
    value: mockLocalStorage,
    writable: true,
});

function flushPromises(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

describe("loadExchangeRates", () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        vi.restoreAllMocks();
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("fetches rates from the API and caches them when localStorage is empty", async () => {
        const mockRates: ExchangeRates = {
            date: "2026-05-24",
            twd: { usd: 0.032, usdt: 0.032, twd: 1 },
        };

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: async () => mockRates,
        } as Response);

        const onUpdate = vi.fn();
        loadExchangeRates("twd", onUpdate);

        // No cache → no sync emit
        expect(onUpdate).not.toHaveBeenCalled();

        await flushPromises();

        expect(fetchSpy).toHaveBeenCalledWith(
            "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json",
        );
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate).toHaveBeenCalledWith(mockRates);

        const cached = localStorage.getItem("inthegreenyet_exchange_rates_twd");
        expect(cached).toBeDefined();
        const parsed = JSON.parse(cached!);
        expect(parsed.rates).toEqual(mockRates);
        expect(Date.now() - parsed.timestamp).toBeLessThan(1000);
    });

    it("emits cached rates synchronously without calling fetch when cache is fresh", async () => {
        const mockRates: ExchangeRates = {
            date: "2026-05-24",
            twd: { usd: 0.032, twd: 1 },
        };

        localStorage.setItem(
            "inthegreenyet_exchange_rates_twd",
            JSON.stringify({
                timestamp: Date.now() - 1000 * 60, // 1 minute ago (fresh since TTL is 12h)
                rates: mockRates,
            }),
        );

        const fetchSpy = vi.spyOn(globalThis, "fetch");

        const onUpdate = vi.fn();
        loadExchangeRates("twd", onUpdate);

        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate).toHaveBeenCalledWith(mockRates);

        await flushPromises();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it("emits stale cache first, then fresh rates after revalidation", async () => {
        const staleRates: ExchangeRates = {
            date: "2026-05-20",
            twd: { usd: 0.031 },
        };
        const freshRates: ExchangeRates = {
            date: "2026-05-24",
            twd: { usd: 0.032 },
        };

        localStorage.setItem(
            "inthegreenyet_exchange_rates_twd",
            JSON.stringify({
                timestamp: Date.now() - 1000 * 60 * 60 * 24, // 24 hours ago (expired)
                rates: staleRates,
            }),
        );

        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: async () => freshRates,
        } as Response);

        const onUpdate = vi.fn();
        loadExchangeRates("twd", onUpdate);

        expect(onUpdate).toHaveBeenNthCalledWith(1, staleRates);

        await flushPromises();
        expect(onUpdate).toHaveBeenNthCalledWith(2, freshRates);
        expect(onUpdate).toHaveBeenCalledTimes(2);
    });

    it("emits only the stale cache when fetch fails", async () => {
        const staleRates: ExchangeRates = {
            date: "2026-05-20",
            twd: { usd: 0.031 },
        };

        localStorage.setItem(
            "inthegreenyet_exchange_rates_twd",
            JSON.stringify({
                timestamp: Date.now() - 1000 * 60 * 60 * 24, // expired
                rates: staleRates,
            }),
        );

        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network Error"));

        const onUpdate = vi.fn();
        loadExchangeRates("twd", onUpdate);

        expect(onUpdate).toHaveBeenNthCalledWith(1, staleRates);

        await flushPromises();
        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it("does not emit when fetch fails and there is no cache", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network Error"));

        const onUpdate = vi.fn();
        loadExchangeRates("twd", onUpdate);

        await flushPromises();
        expect(onUpdate).not.toHaveBeenCalled();
    });
});
