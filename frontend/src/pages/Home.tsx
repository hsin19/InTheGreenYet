import {
    useEffect,
    useState,
} from "react";
import { GitHubIcon } from "../components/icons/GitHubIcon";
import { NotionIcon } from "../components/icons/NotionIcon";
import { useNotion } from "../hooks/useNotion";
import { setup } from "../lib/notion";

type SetupStatus = "idle" | "loading" | "ready" | "error";

function Home() {
    const { auth, transactionDataSourceId, setTransactionDataSourceId, login, logout } = useNotion();
    const [status, setStatus] = useState<SetupStatus>("idle");
    const [error, setError] = useState<string | null>(null);

    // Auto-run setup after login
    useEffect(() => {
        if (!auth) return;

        if (transactionDataSourceId) {
            setStatus("ready");
            return;
        }

        let cancelled = false;
        setStatus("loading");

        const init = async () => {
            try {
                const result = await setup(auth.access_token);
                if (cancelled) return;
                setTransactionDataSourceId(result.transactionDataSourceId);
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                console.error("Setup failed:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                setStatus("error");
            }
        };

        init();
        return () => {
            cancelled = true;
        };
    }, [auth, transactionDataSourceId, setTransactionDataSourceId]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
            {/* Hero */}
            <div className="flex flex-col items-center gap-6 max-w-md text-center">
                {/* Icon with glow */}
                <div className="relative">
                    <div className="absolute inset-0 blur-3xl opacity-20 bg-green-500 rounded-full scale-150" />
                    <img
                        src="/icon.png"
                        alt="InTheGreenYet"
                        className="relative w-24 h-24 drop-shadow-lg"
                    />
                </div>

                {/* Title */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        InTheGreenYet
                    </h1>
                    <p className="mt-2 text-muted text-sm sm:text-base leading-relaxed">
                        It's not about today's profit —<br className="sm:hidden" />
                        it's about knowing where you truly stand.
                    </p>
                </div>

                {/* Auth / Setup state */}
                {auth ? (
                    <div className="mt-4 flex flex-col items-center gap-4">
                        {status === "loading" ? (
                            <div className="bg-surface-card border border-white/10 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg">
                                <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                                <p className="text-muted text-sm">Setting up your workspace...</p>
                            </div>
                        ) : status === "error" ? (
                            <div className="bg-surface-card border border-red-500/20 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg shadow-red-500/5">
                                <span className="text-2xl">❌</span>
                                <p className="text-red-400 text-sm font-medium">Setup failed</p>
                                <p className="text-muted text-xs">{error}</p>
                                <button
                                    onClick={() => {
                                        setError(null);
                                        setStatus("loading");
                                        window.location.reload();
                                    }}
                                    className="mt-2 px-4 py-2 bg-surface border border-white/10 rounded-lg text-sm text-white hover:bg-surface-hover transition-colors cursor-pointer"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <div className="bg-surface-card border border-green-500/20 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg shadow-green-500/5">
                                <div className="flex items-center gap-2 text-green-400 font-medium">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Connected to Notion
                                </div>
                                {auth.workspace_name && (
                                    <p className="text-muted text-sm">
                                        Workspace: <span className="text-white font-medium">{auth.workspace_name}</span>
                                    </p>
                                )}
                                {transactionDataSourceId && (
                                    <a
                                        href={`https://www.notion.so/${transactionDataSourceId.replace(/-/g, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/40"
                                    >
                                        Transaction data source ↗
                                    </a>
                                )}
                            </div>
                        )}

                        <button
                            onClick={logout}
                            className="text-sm text-muted hover:text-white transition-colors cursor-pointer underline underline-offset-4 decoration-muted/40 hover:decoration-white/40"
                        >
                            Disconnect
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={login}
                        className="mt-4 group relative inline-flex items-center gap-2.5 rounded-xl bg-green-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-green-400 hover:shadow-green-400/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                        <NotionIcon className="w-5 h-5" />
                        Connect to Notion
                    </button>
                )}
            </div>

            {/* Footer */}
            <footer className="absolute bottom-6 flex flex-col items-center gap-2 text-xs text-muted/50">
                <p>Your data stays in your Notion workspace.</p>
                <a
                    href="https://github.com/hsin19/InTheGreenYet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted/40 hover:text-muted transition-colors"
                >
                    <GitHubIcon className="w-3.5 h-3.5" />
                    hsin19/InTheGreenYet
                </a>
            </footer>
        </div>
    );
}

export default Home;
