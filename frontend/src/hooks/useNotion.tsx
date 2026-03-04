import {
    createContext,
    type ReactNode,
    useContext,
    useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────

interface NotionAuth {
    access_token: string;
    workspace_name?: string;
    workspace_id?: string;
}

interface NotionState {
    auth: NotionAuth | null;
    transferDataSourceId: string | null;
    login: () => void;
    logout: () => void;
    setAuthData: (auth: NotionAuth) => void;
    setTransferDataSourceId: (id: string) => void;
}

const STORAGE_AUTH_KEY = "notion_auth";
const STORAGE_TRANSFER_DS_KEY = "notion_transfer_ds_id";

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
    const [transferDataSourceId, setTransferDataSourceIdState] = useState<string | null>(
        () => localStorage.getItem(STORAGE_TRANSFER_DS_KEY),
    );

    const login = () => {
        const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;
        const redirectUri = `${apiBase}/auth/notion/callback`;
        const url = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
        window.location.href = url;
    };

    const logout = () => {
        localStorage.removeItem(STORAGE_AUTH_KEY);
        localStorage.removeItem(STORAGE_TRANSFER_DS_KEY);
        setAuth(null);
        setTransferDataSourceIdState(null);
    };

    const setAuthData = (newAuth: NotionAuth) => {
        localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(newAuth));
        setAuth(newAuth);
    };

    const setTransferDataSourceId = (id: string) => {
        localStorage.setItem(STORAGE_TRANSFER_DS_KEY, id);
        setTransferDataSourceIdState(id);
    };

    return (
        <NotionContext value={{ auth, transferDataSourceId, login, logout, setAuthData, setTransferDataSourceId }}>
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
