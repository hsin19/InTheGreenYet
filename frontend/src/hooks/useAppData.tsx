import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { DataSourceNotFoundError } from "../lib/api";
import {
    fetchConfig,
    fetchTransfers,
    type Transfer,
} from "../lib/notion";
import { useNotion } from "./useNotion";

type Status = "loading" | "ready" | "error";

export interface AccountConfig {
    displayName: string;
}

export interface AppConfig {
    currencies: string[];
    accounts: Record<string, AccountConfig>;
}

const DEFAULT_CONFIG: AppConfig = { currencies: [], accounts: {} };

interface AppDataState {
    status: Status;
    transfers: Transfer[];
    config: AppConfig;
    error: string | null;
    refresh: () => void;
    getAccountName: (key: string) => string;
}

const AppDataContext = createContext<AppDataState | null>(null);

export function AppDataProvider({ children }: { children: ReactNode; }) {
    const { auth } = useNotion();
    const [status, setStatus] = useState<Status>("loading");
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
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
                setTransfers(data);
                const map = Object.fromEntries(configRows.map(r => [r.key, r.value]));
                setConfig({
                    currencies: Array.isArray(map.currencies) ? map.currencies : [],
                    accounts: (map.accounts && typeof map.accounts === "object" && !Array.isArray(map.accounts))
                        ? map.accounts as Record<string, AccountConfig>
                        : {},
                });
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                if (err instanceof DataSourceNotFoundError) {
                    setError("Data source not found. Please reconnect to Notion.");
                    setStatus("error");
                    return;
                }
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

    return (
        <AppDataContext value={{ status, transfers, config, error, refresh, getAccountName }}>
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
