import {
    useEffect,
    useState,
} from "react";
import { TransferFormModal } from "../components/TransferFormModal";
import { useNotion } from "../hooks/useNotion";
import { fetchTransfers, type Transfer } from "../lib/notion";
import { DataSourceNotFoundError } from "../lib/utils";

type Status = "loading" | "ready" | "error" | "unauthenticated";

function Transfers() {
    const { auth, config } = useNotion();
    const [status, setStatus] = useState<Status>("loading");
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [isFormOpen, setIsFormOpen] = useState(false);

    const toggleExpand = (id: string) =>
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    const expandAll = () => setExpandedIds(new Set(transfers.map(t => t.id)));
    const collapseAll = () => setExpandedIds(new Set());

    useEffect(() => {
        if (!auth) {
            setStatus("unauthenticated");
            return;
        }

        let cancelled = false;
        const load = async () => {
            setStatus("loading");
            setError(null);
            try {
                const data = await fetchTransfers(auth.access_token);
                if (cancelled) return;
                setTransfers(data);
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                if (err instanceof DataSourceNotFoundError) {
                    setError("Data source not found. Please reconnect to Notion.");
                    setStatus("error");
                    return;
                }
                setError(err instanceof Error ? err.message : "Unknown error");
                setStatus("error");
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [auth, retryCount]);

    return (
        <>
        <div className="flex min-h-screen flex-col px-4 py-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-white">Transfers</h1>
                {status === "ready" && transfers.length > 0 && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={expandAll}
                            className="px-2.5 py-1 text-xs text-muted hover:text-white border border-white/10 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                        >
                            Expand All
                        </button>
                        <button
                            onClick={collapseAll}
                            className="px-2.5 py-1 text-xs text-muted hover:text-white border border-white/10 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                        >
                            Collapse All
                        </button>
                    </div>
                )}
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
                    {transfers.map(transfer => {
                        const twdCost = (() => {
                            const amount = transfer.amount ?? 0;
                            const fee = transfer.fee ?? 0;
                            if (transfer.currency === "TWD") return amount + fee;
                            if (transfer.exchangeRate != null) return (amount + fee) * transfer.exchangeRate;
                            return null;
                        })();
                        const effectiveRate = (twdCost != null && transfer.amount != null && transfer.amount > 0)
                            ? twdCost / transfer.amount
                            : null;
                        const hasDetails = transfer.fee != null || transfer.exchangeRate != null || twdCost != null;
                        const isExpanded = expandedIds.has(transfer.id);

                        return (
                        <li
                            key={transfer.id}
                            className="bg-surface-card border border-white/10 rounded-2xl shadow-sm overflow-hidden"
                        >
                            {/* Clickable header */}
                            <button
                                onClick={() => toggleExpand(transfer.id)}
                                disabled={!hasDetails}
                                className="w-full text-left px-5 py-4 flex flex-col gap-1 cursor-pointer disabled:cursor-default"
                            >
                                {/* Row 1: Title + Amount */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-white font-medium truncate">{transfer.title || "—"}</span>
                                    <span className="flex items-baseline gap-1 shrink-0">
                                        {transfer.amount != null && (
                                            <span className="text-green-400 font-semibold tabular-nums">
                                                {transfer.amount.toLocaleString()}
                                            </span>
                                        )}
                                        {transfer.currency && (
                                            <span className="text-muted text-xs">{transfer.currency}</span>
                                        )}
                                    </span>
                                </div>

                                {/* Row 2: From → To + Date */}
                                <div className="flex items-center justify-between">
                                    <span className="text-muted text-sm">
                                        {transfer.from || "—"}
                                        <span className="mx-1.5 text-white/30">→</span>
                                        {transfer.to || "—"}
                                    </span>
                                    {transfer.date && (
                                        <span className="text-muted text-xs tabular-nums shrink-0">{transfer.date}</span>
                                    )}
                                </div>
                            </button>

                            {/* Row 3: Fee / Rate / TWD Cost — expandable */}
                            {hasDetails && isExpanded && (
                                <div className="flex items-center justify-between px-5 pb-4 pt-1 border-t border-white/5">
                                    <div className="flex items-center gap-3">
                                        {transfer.fee != null && (
                                            <span className="flex items-center gap-1 text-xs">
                                                <span className="text-white/30">Fee</span>
                                                <span className="text-amber-400/80 tabular-nums">
                                                    {transfer.fee.toLocaleString()}
                                                </span>
                                                {transfer.currency && (
                                                    <span className="text-white/20">{transfer.currency}</span>
                                                )}
                                            </span>
                                        )}
                                        {transfer.exchangeRate != null && (
                                            <span className="flex items-center gap-1 text-xs">
                                                <span className="text-white/30">Rate</span>
                                                <span className="text-blue-400/80 tabular-nums">
                                                    {transfer.exchangeRate.toLocaleString()}
                                                </span>
                                            </span>
                                        )}
                                        {effectiveRate != null && transfer.currency !== "TWD" && (
                                            <span className="flex items-center gap-1 text-xs">
                                                <span className="text-white/30">Eff. Rate</span>
                                                <span className="text-purple-400/80 tabular-nums">
                                                    {effectiveRate.toFixed(4)}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                    {twdCost != null && transfer.currency !== "TWD" && (
                                        <span className="flex items-baseline gap-1">
                                            <span className="text-white/30 text-xs">≈</span>
                                            <span className="text-white font-semibold tabular-nums">
                                                {Math.round(twdCost).toLocaleString()}
                                            </span>
                                            <span className="text-muted text-xs">TWD</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </li>
                        );
                    })}
                </ul>
            )}
        </div>

        {/* FAB */}
        {auth && (
            <button
                onClick={() => setIsFormOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 text-black text-2xl font-light shadow-lg shadow-green-500/30 flex items-center justify-center transition-colors cursor-pointer"
            >
                +
            </button>
        )}

        {/* Form modal */}
        {isFormOpen && auth && (
            <TransferFormModal
                token={auth.access_token}
                currencies={config.currencies}
                accounts={config.accounts}
                onClose={() => setIsFormOpen(false)}
                onCreated={() => {
                    setIsFormOpen(false);
                    setRetryCount(c => c + 1);
                }}
            />
        )}
        </>
    );
}

export default Transfers;
