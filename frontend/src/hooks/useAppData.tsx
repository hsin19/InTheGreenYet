import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    createDataStore,
    type DataStore,
} from "../lib/datastore";
import {
    type ExchangeRates,
    fetchExchangeRates,
} from "../lib/exchange";
import type {
    ConfigRow,
    CreateSnapshotInput,
    CreateTransferInput,
    Transfer,
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
    syncing: boolean;
    syncError: string | null;
    lastSyncedAt: number | null;
    canWrite: boolean;
    transfers: Transfer[];
    config: AppConfig;
    exchangeRates: ExchangeRates | null;
    error: string | null;
    refresh: () => void;
    addTransfer: (input: CreateTransferInput) => Promise<string>;
    addSnapshots: (snapshots: CreateSnapshotInput[]) => Promise<void>;
    saveConfig: (key: string, value: unknown) => Promise<void>;
    getAccountName: (key: string) => string;
    getFiatToBaseRate: (currency: string) => number | null;
}

const AppDataContext = createContext<AppDataState | null>(null);

function parseConfig(rows: ConfigRow[]): AppConfig {
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const baseCurrency = typeof map.baseCurrency === "string" ? map.baseCurrency : "TWD";
    const currencies = Array.isArray(map.currencies) ? map.currencies as string[] : [];
    const accounts = (map.accounts && typeof map.accounts === "object" && !Array.isArray(map.accounts))
        ? map.accounts as Record<string, AccountConfig>
        : {};
    return { baseCurrency, currencies, accounts };
}

function sortTransfersDesc(rows: Transfer[]): Transfer[] {
    return [...rows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function AppDataProvider({ children }: { children: ReactNode; }) {
    const { auth } = useNotion();

    const store: DataStore = useMemo(() => createDataStore({ auth }), [auth]);

    const [status, setStatus] = useState<Status>("loading");
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const [prevStore, setPrevStore] = useState(store);
    if (store !== prevStore) {
        setPrevStore(store);
        setStatus("loading");
        setSyncing(false);
        setSyncError(null);
        setLastSyncedAt(null);
        setTransfers([]);
        setConfig(DEFAULT_CONFIG);
        setError(null);
    }

    const refresh = useCallback(() => setRetryCount(c => c + 1), []);

    useEffect(() => {
        if (!auth) return;

        let cancelled = false;
        let hasCache = false;

        const load = async () => {
            setSyncing(true);
            setSyncError(null);

            // 1. Hydrate from whatever the store already has.
            try {
                const [cachedTransfers, cachedConfigRows, cachedSyncedAt] = await Promise.all([
                    store.getTransfers(),
                    store.getConfig(),
                    store.getLastSyncedAt(),
                ]);
                if (cancelled) return;

                if (cachedTransfers.length > 0 || cachedConfigRows.length > 0) {
                    hasCache = true;
                    setTransfers(sortTransfersDesc(cachedTransfers));
                    setConfig(parseConfig(cachedConfigRows));
                    setLastSyncedAt(cachedSyncedAt);
                    setStatus("ready");
                }
            } catch (err) {
                console.warn("Failed to hydrate from store", err);
            }

            // 2. Revalidate against upstream (no-op for non-Swr stores).
            try {
                await store.revalidate();
                if (cancelled) return;

                const [freshTransfers, freshConfigRows, freshSyncedAt] = await Promise.all([
                    store.getTransfers(),
                    store.getConfig(),
                    store.getLastSyncedAt(),
                ]);
                if (cancelled) return;

                const parsed = parseConfig(freshConfigRows);
                const rates = await fetchExchangeRates(parsed.baseCurrency);
                if (cancelled) return;

                setTransfers(sortTransfersDesc(freshTransfers));
                setExchangeRates(rates);
                setConfig(parsed);
                setLastSyncedAt(freshSyncedAt);
                setError(null);
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : "Unknown error";
                if (hasCache) {
                    setSyncError(message);
                } else {
                    setError(message);
                    setStatus("error");
                }
            } finally {
                if (!cancelled) setSyncing(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [auth, store, retryCount]);

    const addTransfer = useCallback(async (input: CreateTransferInput): Promise<string> => {
        const row = await store.addTransfer(input);
        setTransfers(prev => sortTransfersDesc([row, ...prev]));
        return row.id;
    }, [store]);

    const addSnapshots = useCallback(async (snapshots: CreateSnapshotInput[]): Promise<void> => {
        await store.addSnapshots(snapshots);
    }, [store]);

    const saveConfig = useCallback(async (key: string, value: unknown): Promise<void> => {
        await store.saveConfig(key, value);
        setConfig(prev => {
            if (key === "accounts" && value && typeof value === "object" && !Array.isArray(value)) {
                return { ...prev, accounts: value as Record<string, AccountConfig> };
            }
            if (key === "currencies" && Array.isArray(value)) {
                return { ...prev, currencies: value as string[] };
            }
            if (key === "baseCurrency" && typeof value === "string") {
                return { ...prev, baseCurrency: value };
            }
            return prev;
        });
    }, [store]);

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
        <AppDataContext value={{
            status,
            syncing,
            syncError,
            lastSyncedAt,
            canWrite: store.canWrite,
            transfers,
            config,
            exchangeRates,
            error,
            refresh,
            addTransfer,
            addSnapshots,
            saveConfig,
            getAccountName,
            getFiatToBaseRate,
        }}>
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
