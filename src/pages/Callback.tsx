import { Trans } from "@lingui/react/macro";
import {
    useEffect,
    useRef,
} from "react";
import {
    useNavigate,
    useSearchParams,
} from "react-router-dom";
import {
    OAUTH_STATE_KEY,
    useNotion,
} from "../hooks/useNotion";

function Callback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setAuthData } = useNotion();
    // Guard against React StrictMode's double effect invocation: oauth_state is
    // single-use, so the second run would otherwise read null and spuriously fail.
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current) return;
        handled.current = true;

        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = fragment.get("access_token");
        // Scrub the token-bearing fragment from the address bar / history.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);

        const workspaceName = searchParams.get("workspace_name");
        const workspaceId = searchParams.get("workspace_id");
        const error = searchParams.get("error");
        const returnedState = searchParams.get("state");
        const storedState = localStorage.getItem(OAUTH_STATE_KEY);
        localStorage.removeItem(OAUTH_STATE_KEY);

        if (error) {
            console.error("OAuth error:", error);
            navigate(`/landing?error=${encodeURIComponent(error)}`, { replace: true });
            return;
        }

        if (!storedState || storedState !== returnedState) {
            console.error("OAuth state mismatch");
            navigate("/landing?error=state_mismatch", { replace: true });
            return;
        }

        if (!accessToken) {
            navigate("/landing?error=missing_token", { replace: true });
            return;
        }

        setAuthData({
            access_token: accessToken,
            workspace_name: workspaceName ?? undefined,
            workspace_id: workspaceId ?? undefined,
        });

        navigate("/", { replace: true });

        // If login opened us in a new tab, the opener already mirrors notion_auth via
        // its storage listener; close this tab so the user returns there. No-op (and
        // harmless) when we are the same tab that started login.
        if (window.opener && !window.opener.closed) window.close();
    }, [searchParams, navigate, setAuthData]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                <p className="text-muted text-sm font-medium">
                    <Trans>Connecting to Notion…</Trans>
                </p>
            </div>
        </div>
    );
}

export default Callback;
