import {
    Plus,
    RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { TransferFormModal } from "../components/TransferFormModal";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppData } from "../hooks/useAppData";
import { useNotion } from "../hooks/useNotion";

function Transfers() {
    const { auth } = useNotion();
    const { status, transfers, config, error, refresh, getAccountName, getFiatToTwdRate } = useAppData();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [isFormOpen, setIsFormOpen] = useState(false);

    const toggleExpand = (id: string) =>
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    const expandAll = () => setExpandedIds(new Set(transfers.map(t => t.id)));
    const collapseAll = () => setExpandedIds(new Set());

    return (
        <>
            <div className="flex min-h-screen flex-col px-4 py-8 max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-white">Transfers</h1>
                    <div className="flex items-center gap-2">
                        {status === "ready" && transfers.length > 0 && (
                            <>
                                <Button variant="outline" size="sm" onClick={expandAll}>
                                    Expand All
                                </Button>
                                <Button variant="outline" size="sm" onClick={collapseAll}>
                                    Collapse All
                                </Button>
                            </>
                        )}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={refresh}
                            disabled={status === "loading"}
                        >
                            <RefreshCw className={`w-4 h-4 ${status === "loading" ? "animate-spin" : ""}`} />
                        </Button>
                        {auth && (
                            <Button onClick={() => setIsFormOpen(true)}>
                                <Plus className="w-4 h-4 mr-1.5" />
                                Add Transfer
                            </Button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {status === "loading" && (
                    <div className="flex flex-col items-center gap-3 py-16">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                        <p className="text-muted text-sm">Loading transfers...</p>
                    </div>
                )}

                {status === "error" && (
                    <Card className="items-center text-center p-8 gap-3 border-red-500/20 shadow-red-500/5">
                        <span className="text-2xl">❌</span>
                        <p className="text-red-400 text-sm font-medium">Failed to load transfers</p>
                        <p className="text-muted text-xs">{error}</p>
                        <Button variant="secondary" onClick={refresh} className="mt-2">
                            Retry
                        </Button>
                    </Card>
                )}

                {status === "ready" && transfers.length === 0 && (
                    <Card className="items-center text-center p-8 gap-2">
                        <p className="text-white font-medium">No transfers yet</p>
                        <p className="text-muted text-sm">Add transfers in your Notion database to see them here.</p>
                    </Card>
                )}

                {status === "ready" && transfers.length > 0 && (
                    <ul className="flex flex-col gap-3">
                        {transfers.map(transfer => {
                            const twdCost = (() => {
                                const amount = transfer.amount ?? 0;
                                const fee = transfer.fee ?? 0;
                                if (transfer.currency === "TWD") return amount + fee;
                                if (transfer.exchangeRate != null) return (amount + fee) * transfer.exchangeRate;

                                const liveRate = getFiatToTwdRate(transfer.currency ?? "");
                                if (liveRate != null) {
                                    return (amount + fee) * liveRate;
                                }
                                return null;
                            })();
                            const effectiveRate = (twdCost != null && transfer.amount != null && transfer.amount > 0)
                                ? twdCost / transfer.amount
                                : null;
                            const hasDetails = transfer.fee != null || transfer.exchangeRate != null || twdCost != null;
                            const isExpanded = expandedIds.has(transfer.id);

                            return (
                                <Card
                                    key={transfer.id}
                                    className="p-0 gap-0"
                                >
                                    {/* Clickable header */}
                                    <button
                                        onClick={() => toggleExpand(transfer.id)}
                                        disabled={!hasDetails}
                                        className="w-full text-left px-5 py-4 flex flex-col gap-1 cursor-pointer disabled:cursor-default bg-transparent border-0 hover:bg-white/5 transition-colors"
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
                                                {transfer.currency && <span className="text-muted text-xs">{transfer.currency}</span>}
                                            </span>
                                        </div>

                                        {/* Row 2: From → To + Date */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted text-sm">
                                                {transfer.from ? getAccountName(transfer.from) : "—"}
                                                <span className="mx-1.5 text-white/30">→</span>
                                                {transfer.to ? getAccountName(transfer.to) : "—"}
                                            </span>
                                            {transfer.date && <span className="text-muted text-xs tabular-nums shrink-0">{transfer.date}</span>}
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
                                                        {transfer.currency && <span className="text-white/20">{transfer.currency}</span>}
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
                                </Card>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Form modal */}
            {isFormOpen && auth && (
                <TransferFormModal
                    token={auth.access_token}
                    currencies={config.currencies}
                    accounts={config.accounts}
                    onClose={() => setIsFormOpen(false)}
                    onCreated={() => {
                        setIsFormOpen(false);
                        refresh();
                    }}
                />
            )}
        </>
    );
}

export default Transfers;
