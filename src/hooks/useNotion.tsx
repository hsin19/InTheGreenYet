import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useState,
} from "react";
import { apiFetch } from "../lib/api";
import { disposeWorkspaceData } from "../lib/datastore";

interface NotionAuth {
    access_token: string;
    workspace_name?: string;
    workspace_id?: string;
}

interface NotionState {
    auth: NotionAuth | null;
    login: () => Promise<void>;
    logout: () => void;
    setAuthData: (auth: NotionAuth) => void;
}

const STORAGE_AUTH_KEY = "notion_auth";

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

    const login = useCallback(async () => {
        // The Notion client id is public but lives only in the Worker config; fetch
        // it at click time so there is a single source of truth (no build-time env).
        const { notionClientId } = await apiFetch<{ notionClientId: string; }>("/api/public-config");
        const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;
        const redirectUri = `${apiBase}/auth/notion/callback`;
        const state = crypto.randomUUID();
        sessionStorage.setItem("oauth_state", state);
        const url = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${notionClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
        window.location.href = url;
    }, []);

    const logout = useCallback(() => {
        const workspaceId = auth?.workspace_id ?? "default";
        disposeWorkspaceData(workspaceId).catch(err => console.warn("Failed to dispose workspace data", err));
        localStorage.removeItem(STORAGE_AUTH_KEY);
        setAuth(null);
    }, [auth]);

    const setAuthData = useCallback((newAuth: NotionAuth) => {
        localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(newAuth));
        setAuth(newAuth);
    }, []);

    return (
        <NotionContext value={{ auth, login, logout, setAuthData }}>
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
