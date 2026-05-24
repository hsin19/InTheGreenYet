import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    type ExchangeRates,
    fetchExchangeRates,
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

describe("Exchange Rate Fetching", () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        vi.restoreAllMocks();
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("should fetch rates from API and cache them when local storage is empty", async () => {
        const mockRates: ExchangeRates = {
            date: "2026-05-24",
            twd: { usd: 0.032, usdt: 0.032, twd: 1 },
        };

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: async () => mockRates,
        } as Response);

        const result = await fetchExchangeRates("twd");

        expect(fetchSpy).toHaveBeenCalledWith(
            "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json",
        );
        expect(result).toEqual(mockRates);

        // Check if cached in localStorage
        const cached = localStorage.getItem("inthegreenyet_exchange_rates_twd");
        expect(cached).toBeDefined();
        const parsed = JSON.parse(cached!);
        expect(parsed.rates).toEqual(mockRates);
        expect(Date.now() - parsed.timestamp).toBeLessThan(1000);
    });

    it("should return cached rates if they are fresh without calling fetch", async () => {
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

        const result = await fetchExchangeRates("twd");

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result).toEqual(mockRates);
    });

    it("should fetch fresh rates if cached rates are expired", async () => {
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

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: async () => freshRates,
        } as Response);

        const result = await fetchExchangeRates("twd");

        expect(fetchSpy).toHaveBeenCalled();
        expect(result).toEqual(freshRates);
    });

    it("should fallback to stale cache if fetch fails", async () => {
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

        const result = await fetchExchangeRates("twd");

        expect(result).toEqual(staleRates);
    });

    it("should return null if fetch fails and there is no cache", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network Error"));

        const result = await fetchExchangeRates("twd");

        expect(result).toBeNull();
    });
});
