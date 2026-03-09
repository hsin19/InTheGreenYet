import { setOnDataSourceNotFound } from "@/lib/api";
import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import {
    type ExchangeRates,
    fetchExchangeRates,
} from "../lib/exchange";
import {
    fetchConfig,
    fetchTransfers,
    type Transfer,
} from "../lib/notion";
import { useNotion } from "./useNotion";

type Status = "loading" | "ready" | "error";

export interface AccountConfig {
    displayName: string;
    amount?: number | null;
    currency?: string | null;
    amountUpdatedAt?: string | null;
    isInvestment?: boolean;
    accountType?: string;
}

export interface AppConfig {
    baseCurrency: string;
    currencies: string[];
    accounts: Record<string, AccountConfig>;
}

const DEFAULT_CONFIG: AppConfig = { baseCurrency: "TWD", currencies: [], accounts: {} };

interface AppDataState {
    status: Status;
    transfers: Transfer[];
    config: AppConfig;
    exchangeRates: ExchangeRates | null;
    error: string | null;
    refresh: () => void;
    getAccountName: (key: string) => string;
    getFiatToBaseRate: (currency: string) => number | null;
}

const AppDataContext = createContext<AppDataState | null>(null);

export function AppDataProvider({ children }: { children: ReactNode; }) {
    const { auth } = useNotion();
    const [status, setStatus] = useState<Status>("loading");
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const [prevAuth, setPrevAuth] = useState(auth);
    if (auth !== prevAuth) {
        setPrevAuth(auth);
        setStatus("loading");
        setTransfers([]);
        setConfig(DEFAULT_CONFIG);
        setError(null);
    }

    const refresh = () => setRetryCount(c => c + 1);

    useEffect(() => {
        if (!auth) {
            return;
        }

        let cancelled = false;
        const load = async () => {
            setStatus("loading");
            setError(null);
            try {
                const [data, configRows] = await Promise.all([
                    fetchTransfers(auth.access_token),
                    fetchConfig(auth.access_token),
                ]);
                if (cancelled) return;

                const map = Object.fromEntries(configRows.map(r => [r.key, r.value]));
                const baseCurrency = typeof map.baseCurrency === "string" ? map.baseCurrency : "TWD";

                const rates = await fetchExchangeRates(baseCurrency);
                if (cancelled) return;

                setTransfers(data);
                setExchangeRates(rates);
                setConfig({
                    baseCurrency,
                    currencies: Array.isArray(map.currencies) ? map.currencies : [],
                    accounts: (map.accounts && typeof map.accounts === "object" && !Array.isArray(map.accounts))
                        ? map.accounts as Record<string, AccountConfig>
                        : {},
                });
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Unknown error");
                setStatus("error");
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [auth, retryCount]);

    const getAccountName = useCallback((key: string) => {
        if (!key) return key;
        const exactMatch = config.accounts[key];
        if (exactMatch) return exactMatch.displayName;

        const lowerKey = key.toLowerCase();
        const insensitiveMatch = Object.entries(config.accounts).find(([k]) => k.toLowerCase() === lowerKey);

        return insensitiveMatch ? insensitiveMatch[1].displayName : key;
    }, [config.accounts]);

    const getFiatToBaseRate = useCallback((currency: string) => {
        if (!currency) return null;
        const upper = currency.toUpperCase();
        const base = config.baseCurrency.toUpperCase();
        if (upper === base) return 1;

        const normalized = upper.toLowerCase();
        const baseLower = base.toLowerCase();

        if (exchangeRates && typeof exchangeRates[baseLower] === "object") {
            const rateDict = exchangeRates[baseLower] as Record<string, number>;
            const rate = rateDict[normalized];
            if (rate && typeof rate === "number") {
                // If API says 1 TWD = 0.0314 USD, then 1 USD = 1 / 0.0314 TWD
                return 1 / rate;
            }
        }

        // Hard fallback if the fiat rate is totally disconnected for USD -> TWD specifically, just as a safety net
        if (normalized === "usd" && base === "TWD") return 31.5;

        return null;
    }, [exchangeRates, config.baseCurrency]);

    return (
        <AppDataContext value={{ status, transfers, config, exchangeRates, error, refresh, getAccountName, getFiatToBaseRate }}>
            {children}
        </AppDataContext>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData(): AppDataState {
    const ctx = useContext(AppDataContext);
    if (!ctx) throw new Error("useAppData must be used within <AppDataProvider>");
    return ctx;
}
