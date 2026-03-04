import {
    useEffect,
    useState,
} from "react";
import { Link } from "react-router-dom";
import { useNotion } from "../hooks/useNotion";
import { fetchTransfers, type Transfer } from "../lib/notion";

type Status = "loading" | "ready" | "error" | "unauthenticated";

function Transfers() {
    const { auth, transferDataSourceId } = useNotion();
    const [status, setStatus] = useState<Status>("loading");
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (!auth) {
            setStatus("unauthenticated");
            return;
        }
        if (!transferDataSourceId) {
            setStatus("unauthenticated");
            return;
        }

        let cancelled = false;
        const load = async () => {
            setStatus("loading");
            setError(null);
            try {
                const data = await fetchTransfers(auth.access_token, transferDataSourceId);
                if (cancelled) return;
                setTransfers(data);
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Unknown error");
                setStatus("error");
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [auth, transferDataSourceId, retryCount]);

    return (
        <div className="flex min-h-screen flex-col px-4 py-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link
                    to="/"
                    className="text-sm text-muted hover:text-white transition-colors"
                >
                    ← Home
                </Link>
                <h1 className="text-2xl font-bold text-white">Transfers</h1>
            </div>

            {/* Content */}
            {status === "loading" && (
                <div className="flex flex-col items-center gap-3 py-16">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                    <p className="text-muted text-sm">Loading transfers...</p>
                </div>
            )}

            {status === "unauthenticated" && (
                <div className="bg-surface-card border border-white/10 rounded-2xl px-8 py-8 flex flex-col items-center gap-4 shadow-lg">
                    <p className="text-muted text-sm">You need to connect to Notion first.</p>
                    <Link
                        to="/"
                        className="px-4 py-2 bg-green-500 hover:bg-green-400 rounded-lg text-sm text-white font-medium transition-colors"
                    >
                        Go to Home
                    </Link>
                </div>
            )}

            {status === "error" && (
                <div className="bg-surface-card border border-red-500/20 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg shadow-red-500/5">
                    <span className="text-2xl">❌</span>
                    <p className="text-red-400 text-sm font-medium">Failed to load transfers</p>
                    <p className="text-muted text-xs">{error}</p>
                    <button
                        onClick={() => setRetryCount(c => c + 1)}
                        className="mt-2 px-4 py-2 bg-surface border border-white/10 rounded-lg text-sm text-white hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {status === "ready" && transfers.length === 0 && (
                <div className="bg-surface-card border border-white/10 rounded-2xl px-8 py-8 flex flex-col items-center gap-2 shadow-lg">
                    <p className="text-white font-medium">No transfers yet</p>
                    <p className="text-muted text-sm">Add transfers in your Notion database to see them here.</p>
                </div>
            )}

            {status === "ready" && transfers.length > 0 && (
                <ul className="flex flex-col gap-3">
                    {transfers.map(transfer => (
                        <li
                            key={transfer.id}
                            className="bg-surface-card border border-white/10 rounded-2xl px-5 py-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-white font-medium">{transfer.title || "—"}</span>
                                <span className="flex items-baseline gap-1">
                                    {transfer.amount != null && (
                                        <span className="text-green-400 font-semibold">{transfer.amount}</span>
                                    )}
                                    {transfer.currency && (
                                        <span className="text-muted text-xs">{transfer.currency}</span>
                                    )}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-muted text-sm">
                                    {transfer.from || "—"} → {transfer.to || "—"}
                                </span>
                                {transfer.date && (
                                    <span className="text-muted text-xs">{transfer.date}</span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default Transfers;
