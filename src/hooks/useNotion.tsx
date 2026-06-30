import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
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
    login: () => Promise<void>;
    logout: () => void;
    setAuthData: (auth: NotionAuth) => void;
}

const STORAGE_AUTH_KEY = "notion_auth";
export const OAUTH_STATE_KEY = "oauth_state";

const NotionContext = createContext<NotionState | null>(null);

function readStoredAuth(): NotionAuth | null {
    const stored = localStorage.getItem(STORAGE_AUTH_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        localStorage.removeItem(STORAGE_AUTH_KEY);
        return null;
    }
}

export function NotionProvider({ children }: { children: ReactNode; }) {
    const [auth, setAuth] = useState<NotionAuth | null>(readStoredAuth);

    // The Notion client id is public but lives only in the Worker config. Prefetch
    // it on mount so login() can navigate synchronously inside the click gesture:
    // an awaited fetch at click time consumes the user activation, which makes the
    // new-tab open below get popup-blocked.
    const clientIdRef = useRef<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        apiFetch<{ notionClientId: string; }>("/api/public-config")
            .then(({ notionClientId }) => {
                if (!cancelled) clientIdRef.current = notionClientId;
            })
            .catch(err => console.warn("Failed to prefetch Notion client id", err));
        return () => {
            cancelled = true;
        };
    }, []);

    // When the OAuth callback completes in another tab (the new tab opened by
    // login below), it writes notion_auth to localStorage; mirror that here so the
    // tab that started login does not stay stale.
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_AUTH_KEY) setAuth(readStoredAuth());
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const login = useCallback(async () => {
        const state = crypto.randomUUID();
        // localStorage (not sessionStorage) so the callback can read the state even
        // when it lands in a different tab — sessionStorage is not shared across the
        // new tab opened below, especially after the cross-origin Notion hop.
        localStorage.setItem(OAUTH_STATE_KEY, state);
        const redirectUri = `${window.location.origin}/auth/notion/callback`;

        const clientId = clientIdRef.current
            ?? (await apiFetch<{ notionClientId: string; }>("/api/public-config")).notionClientId;
        const authorizeUrl = buildNotionAuthorizeUrl(clientId, redirectUri, state);

        // On iOS, a same-tab redirect to api.notion.com is hijacked by the Notion
        // app's universal link and dead-ends. Opening a fresh top-level browsing
        // context from the user gesture keeps the consent page in the browser.
        // window.open returns null if the gesture was already consumed (we had to
        // await the client id) or the popup was blocked — fall back to same-tab.
        const opened = clientIdRef.current ? window.open(authorizeUrl, "_blank") : null;
        if (!opened) window.location.href = authorizeUrl;
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
