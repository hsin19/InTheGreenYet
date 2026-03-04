import {
    useEffect,
    useState,
} from "react";
import {
    Navigate,
    NavLink,
    Outlet,
} from "react-router-dom";
import { useNotion } from "../hooks/useNotion";
import { setup } from "../lib/notion";

function AppNav() {
    const { auth, logout } = useNotion();

    return (
        <header className="fixed top-0 inset-x-0 h-14 flex items-center justify-between px-6 border-b border-white/10 bg-surface/80 backdrop-blur z-10">
            <span className="font-semibold text-white text-sm">InTheGreenYet</span>
            <nav className="flex items-center gap-6">
                <NavLink
                    to="/transfers"
                    className={({ isActive }) => `text-sm transition-colors ${isActive ? "text-white font-medium" : "text-muted hover:text-white"}`}
                >
                    Transfers
                </NavLink>
            </nav>
            <button
                onClick={logout}
                className="text-sm text-muted hover:text-white transition-colors cursor-pointer"
            >
                {auth?.workspace_name ?? "Disconnect"}
                <span className="ml-2 text-muted/50">↩</span>
            </button>
        </header>
    );
}

type SetupStatus = "pending" | "running" | "done" | "error";

function AppLayout() {
    const { auth, transferDataSourceId, setTransferDataSourceId } = useNotion();
    const [setupStatus, setSetupStatus] = useState<SetupStatus>("pending");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!auth || transferDataSourceId) return;

        let cancelled = false;
        const init = async () => {
            setSetupStatus("running");
            try {
                const result = await setup(auth.access_token);
                if (cancelled) return;
                setTransferDataSourceId(result.transferDataSourceId);
                setSetupStatus("done");
            } catch (err) {
                if (cancelled) return;
                console.error("Setup failed:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                setSetupStatus("error");
            }
        };

        init();
        return () => {
            cancelled = true;
        };
    }, [auth, transferDataSourceId, setTransferDataSourceId]);

    if (!auth) return <Navigate to="/landing" replace />;

    return (
        <div className="pt-14">
            <AppNav />
            <Outlet />

            {!transferDataSourceId && (
                <div className="fixed inset-0 bg-surface flex items-center justify-center px-4 z-50">
                    {setupStatus === "error" ? (
                        <div className="bg-surface-card border border-red-500/20 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg shadow-red-500/5">
                            <span className="text-2xl">❌</span>
                            <p className="text-red-400 text-sm font-medium">Setup failed</p>
                            <p className="text-muted text-xs">{error}</p>
                            <button
                                onClick={() => {
                                    setError(null);
                                    setSetupStatus("pending");
                                }}
                                className="mt-2 px-4 py-2 bg-surface border border-white/10 rounded-lg text-sm text-white hover:bg-surface-hover transition-colors cursor-pointer"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <div className="bg-surface-card border border-white/10 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg">
                            <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                            <p className="text-muted text-sm">Setting up your workspace...</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AppLayout;
