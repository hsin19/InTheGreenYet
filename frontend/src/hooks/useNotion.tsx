import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { init } from "../lib/notion";

// ─── Types ────────────────────────────────────────────────────

interface NotionAuth {
    access_token: string;
    workspace_name?: string;
    workspace_id?: string;
}

export type InitStatus = "idle" | "initializing" | "done" | "error";

interface NotionState {
    auth: NotionAuth | null;
    initStatus: InitStatus;
    initError: string | null;
    login: () => void;
    logout: () => void;
    retryInit: () => void;
    setAuthData: (auth: NotionAuth) => void;
}

const STORAGE_AUTH_KEY = "notion_auth";

const NOTION_CLIENT_ID = import.meta.env.VITE_NOTION_CLIENT_ID;

// ─── Context ──────────────────────────────────────────────────

const NotionContext = createContext<NotionState | null>(null);

export function NotionProvider({ children }: { children: ReactNode; }) {
    const [auth, setAuth] = useState<NotionAuth | null>(() => {
        const stored = localStorage.getItem(STORAGE_AUTH_KEY);
        if (!stored) return null;
        try {
            return JSON.parse(stored);
        } catch {
            localStorage.removeItem(STORAGE_AUTH_KEY);
            return null;
        }
    });

    const [initStatus, setInitStatus] = useState<InitStatus>("idle");
    const [initError, setInitError] = useState<string | null>(null);
    const initingRef = useRef(false);

    const login = useCallback(() => {
        const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;
        const redirectUri = `${apiBase}/auth/notion/callback`;
        const url = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
        window.location.href = url;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_AUTH_KEY);
        setAuth(null);
        setInitStatus("idle");
        setInitError(null);
        initingRef.current = false;
    }, []);

    const setAuthData = useCallback((newAuth: NotionAuth) => {
        localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(newAuth));
        setAuth(newAuth);
    }, []);

    useEffect(() => {
        if (!auth || initStatus !== "idle" || initingRef.current) return;
        initingRef.current = true;

        const initialize = async () => {
            // Wait for next microtask to avoid synchronous setState inside rendering flow
            await Promise.resolve();
            setInitStatus("initializing");

            try {
                await init(auth.access_token);
                setInitStatus("done");
            } catch (err) {
                setInitError(err instanceof Error ? err.message : "Unknown error");
                setInitStatus("error");
                initingRef.current = false;
            }
        };

        void initialize();
    }, [auth, initStatus]);

    const retryInit = useCallback(() => {
        initingRef.current = false;
        setInitStatus("idle");
        setInitError(null);
    }, []);

    return (
        <NotionContext value={{ auth, initStatus, initError, login, logout, retryInit, setAuthData }}>
            {children}
        </NotionContext>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotion(): NotionState {
    const ctx = useContext(NotionContext);
    if (!ctx) throw new Error("useNotion must be used within <NotionProvider>");
    return ctx;
}
