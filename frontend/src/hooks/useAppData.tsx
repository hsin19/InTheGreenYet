import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import { useNotion } from "./useNotion";
import {
    fetchConfig,
    fetchTransfers,
    type Transfer,
} from "../lib/notion";
import { DataSourceNotFoundError } from "../lib/utils";

type Status = "loading" | "ready" | "error";

export interface AppConfig {
    currencies: string[];
    accounts: string[];
}

const DEFAULT_CONFIG: AppConfig = { currencies: [], accounts: [] };

interface AppDataState {
    status: Status;
    transfers: Transfer[];
    config: AppConfig;
    error: string | null;
    refresh: () => void;
}

const AppDataContext = createContext<AppDataState | null>(null);

export function AppDataProvider({ children }: { children: ReactNode; }) {
    const { auth } = useNotion();
    const [status, setStatus] = useState<Status>("loading");
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const refresh = () => setRetryCount(c => c + 1);

    useEffect(() => {
        if (!auth) {
            setStatus("loading");
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
                    accounts: Array.isArray(map.accounts) ? map.accounts : [],
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

    return (
        <AppDataContext value={{ status, transfers, config, error, refresh }}>
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
