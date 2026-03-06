import { useEffect } from "react";
import {
    useNavigate,
    useSearchParams,
} from "react-router-dom";
import { useNotion } from "../hooks/useNotion";

function Callback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setAuthData } = useNotion();

    useEffect(() => {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = fragment.get("access_token");
        const workspaceName = searchParams.get("workspace_name");
        const workspaceId = searchParams.get("workspace_id");
        const error = searchParams.get("error");

        if (error) {
            console.error("OAuth error:", error);
            navigate("/landing", { replace: true });
            return;
        }

        if (!accessToken) {
            navigate("/landing", { replace: true });
            return;
        }

        setAuthData({
            access_token: accessToken,
            workspace_name: workspaceName ?? undefined,
            workspace_id: workspaceId ?? undefined,
        });

        navigate("/", { replace: true });
    }, [searchParams, navigate, setAuthData]);

    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p>Connecting to Notion...</p>
        </div>
    );
}

export default Callback;
