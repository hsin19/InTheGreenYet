export interface ExchangeRates {
    date: string;
    [baseCurrency: string]: Record<string, number> | string | undefined;
}

const CACHE_KEY = "inthegreenyet_exchange_rates";
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

interface CacheData {
    timestamp: number;
    rates: ExchangeRates;
}

/**
 * Fetches exchange rates from fawazahmed0 currency-api.
 * Caches the result in localStorage to prevent rate limiting/unnecessary requests.
 * @param baseCurrency The currency to fetch rates against (e.g., 'usd')
 */
export async function fetchExchangeRates(baseCurrency: string = "twd"): Promise<ExchangeRates | null> {
    const cacheKey = `${CACHE_KEY}_${baseCurrency.toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        try {
            const parsed: CacheData = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_TTL) {
                return parsed.rates;
            }
        } catch (e) {
            console.warn("Failed to parse cached exchange rates", e);
        }
    }

    try {
        const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseCurrency.toLowerCase()}.json`;
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`Failed to fetch exchange rates: ${res.status} ${res.statusText}`);
        }

        const data: ExchangeRates = await res.json();

        const cacheData: CacheData = {
            timestamp: Date.now(),
            rates: data,
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));

        return data;
    } catch (error) {
        console.error("Error fetching exchange rates:", error);

        // If fetch fails but we have stale cache, return it as fallback
        if (cached) {
            try {
                const parsed: CacheData = JSON.parse(cached);
                console.log("Using stale cached exchange rates as fallback");
                return parsed.rates;
            } catch (e) {
                // Ignore parsing errors on fallback
            }
        }

        return null;
    }
}
