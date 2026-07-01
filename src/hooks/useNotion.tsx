import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useRef,
    useState,
} from "react";
import { apiFetch } from "../lib/api";
import { disposeWorkspaceData } from "../lib/datastore";
import { buildNotionAuthorizeUrl } from "../lib/notionOAuth";

interface NotionAuth {
    access_token: string;
    workspace_name?: string;
    workspace_id?: string;
}

interface NotionState {
    auth: NotionAuth | null;
    prepareLogin: () => Promise<string>;
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

    // Build the Notion authorize URL once: fetch the public client id, mint and
    // persist the CSRF state, assemble the URL. Cached as a promise so Landing can
    // prefetch it for the link's href while login() reuses the same URL — the href
    // and the redirect must carry the same state or the callback's CSRF check fails.
    const authorizeUrlRef = useRef<Promise<string> | null>(null);
    const prepareLogin = useCallback((): Promise<string> => {
        if (!authorizeUrlRef.current) {
            authorizeUrlRef.current = (async () => {
                const { notionClientId } = await apiFetch<{ notionClientId: string; }>("/api/public-config");
                const state = crypto.randomUUID();
                sessionStorage.setItem("oauth_state", state);
                const redirectUri = `${window.location.origin}/auth/notion/callback`;
                return buildNotionAuthorizeUrl(notionClientId, redirectUri, state);
            })().catch(err => {
                authorizeUrlRef.current = null; // let a later attempt retry the fetch
                throw err;
            });
        }
        return authorizeUrlRef.current;
    }, []);

    const login = useCallback(async () => {
        window.location.href = await prepareLogin();
    }, [prepareLogin]);

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
        <NotionContext value={{ auth, prepareLogin, login, logout, setAuthData }}>
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
