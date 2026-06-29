import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppData } from "@/hooks/useAppData";
import { useNotion } from "@/hooks/useNotion";
import {
    Trans,
    useLingui,
} from "@lingui/react/macro";
import {
    AlertCircle,
    ChevronsDown,
    ChevronsUp,
    Plus,
    RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { TransferDialog } from "./components/TransferDialog";

function Transfers() {
    const { auth } = useNotion();
    const { status, transfers, config, error, refresh, getAccountName, getFiatToBaseRate } = useAppData();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [addOpen, setAddOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const { t } = useLingui();

    const accountKeys = [...new Set(transfers.flatMap(t => [t.from, t.to].filter(Boolean)))];
    const filteredTransfers = selectedAccount
        ? transfers.filter(t => t.from === selectedAccount || t.to === selectedAccount)
        : transfers;

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
    const expandAll = () => setExpandedIds(new Set(filteredTransfers.map(t => t.id)));
    const collapseAll = () => setExpandedIds(new Set());

    return (
        <div className="flex min-h-full flex-col px-4 py-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-white text-pretty">
                    <Trans>Transfers</Trans>
                </h1>
                <div className="flex items-center gap-2">
                    {status === "ready" && filteredTransfers.length > 0 && (
                        <>
                            <Button variant="outline" size="icon" onClick={expandAll} aria-label={t`Expand all transfers`} title={t`Expand all`}>
                                <ChevronsDown className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={collapseAll} aria-label={t`Collapse all transfers`} title={t`Collapse all`}>
                                <ChevronsUp className="w-4 h-4" />
                            </Button>
                        </>
                    )}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={refresh}
                        disabled={status === "loading"}
                        aria-label={t`Refresh transfers`}
                        title={t`Refresh`}
                    >
                        <RefreshCw className={`w-4 h-4 ${status === "loading" ? "animate-spin" : ""}`} />
                    </Button>
                    {auth && (
                        <Button size="icon" onClick={() => setAddOpen(true)} aria-label={t`Add transfer`} title={t`Add transfer`}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Content */}
            {status === "loading" && (
                <div className="flex flex-col items-center gap-3 py-16">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                    <p className="text-muted text-sm">
                        <Trans>Loading transfers…</Trans>
                    </p>
                </div>
            )}

            {status === "error" && (
                <Card className="items-center text-center p-8 gap-3 border-red-500/20 shadow-red-500/5">
                    <AlertCircle className="size-7 text-rose-400" aria-hidden="true" />
                    <p className="text-red-400 text-sm font-medium">
                        <Trans>Failed to load transfers</Trans>
                    </p>
                    <p className="text-muted text-xs">{error}</p>
                    <Button variant="secondary" onClick={refresh} className="mt-2">
                        <Trans>Retry</Trans>
                    </Button>
                </Card>
            )}

            {status === "ready" && transfers.length === 0 && (
                <Card className="items-center text-center p-8 gap-3">
                    <p className="text-white font-medium">
                        <Trans>No transfers yet</Trans>
                    </p>
                    <p className="text-muted text-sm">
                        <Trans>Record a deposit, withdrawal, or move between your accounts.</Trans>
                    </p>
                    {auth && (
                        <Button variant="link" onClick={() => setAddOpen(true)}>
                            <Trans>Add your first transfer &rarr;</Trans>
                        </Button>
                    )}
                </Card>
            )}

            {status === "ready" && transfers.length > 0 && accountKeys.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <Button
                        variant={selectedAccount === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedAccount(null)}
                    >
                        <Trans>All</Trans>
                    </Button>
                    {accountKeys.map(key => (
                        <Button
                            key={key}
                            variant={selectedAccount === key ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedAccount(prev => prev === key ? null : key)}
                        >
                            {getAccountName(key)}
                        </Button>
                    ))}
                </div>
            )}

            {status === "ready" && transfers.length > 0 && filteredTransfers.length === 0 && (
                <Card className="items-center text-center p-8 gap-2">
                    <p className="text-white font-medium">
                        <Trans>No transfers for this account</Trans>
                    </p>
                </Card>
            )}

            {status === "ready" && filteredTransfers.length > 0 && (
                <ul className="flex flex-col gap-3">
                    {filteredTransfers.map(transfer => {
                        const baseCost = (() => {
                            const amount = transfer.amount ?? 0;
                            const fee = transfer.fee ?? 0;
                            const base = config.baseCurrency.toUpperCase();
                            if (transfer.currency === base) return amount + fee;
                            if (transfer.exchangeRate != null) return (amount + fee) * transfer.exchangeRate;

                            const liveRate = getFiatToBaseRate(transfer.currency ?? "");
                            if (liveRate != null) {
                                return (amount + fee) * liveRate;
                            }
                            return null;
                        })();
                        const effectiveRate = (baseCost != null && transfer.amount != null && transfer.amount > 0)
                            ? baseCost / transfer.amount
                            : null;
                        const hasDetails = transfer.fee != null || transfer.exchangeRate != null || baseCost != null;
                        const isExpanded = expandedIds.has(transfer.id);

                        return (
                            <li key={transfer.id}>
                                <Card className="p-0 gap-0">
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

                                    {/* Row 3: Fee / Rate / Base Cost — expandable */}
                                    {hasDetails && isExpanded && (
                                        <div className="flex items-center justify-between px-5 pb-4 pt-1 border-t border-white/5">
                                            <div className="flex items-center gap-3">
                                                {transfer.fee != null && (
                                                    <span className="flex items-center gap-1 text-xs">
                                                        <span className="text-white/30">
                                                            <Trans>Fee</Trans>
                                                        </span>
                                                        <span className="text-amber-400/80 tabular-nums">
                                                            {transfer.fee.toLocaleString()}
                                                        </span>
                                                        {transfer.currency && <span className="text-white/20">{transfer.currency}</span>}
                                                    </span>
                                                )}
                                                {transfer.exchangeRate != null && (
                                                    <span className="flex items-center gap-1 text-xs">
                                                        <span className="text-white/30">
                                                            <Trans>Rate</Trans>
                                                        </span>
                                                        <span className="text-blue-400/80 tabular-nums">
                                                            {transfer.exchangeRate.toLocaleString()}
                                                        </span>
                                                    </span>
                                                )}
                                                {effectiveRate != null && transfer.currency !== config.baseCurrency && (
                                                    <span className="flex items-center gap-1 text-xs">
                                                        <span className="text-white/30">
                                                            <Trans>Eff. Rate</Trans>
                                                        </span>
                                                        <span className="text-purple-400/80 tabular-nums">
                                                            {effectiveRate.toFixed(4)}
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                            {baseCost != null && transfer.currency !== config.baseCurrency && (
                                                <span className="flex items-baseline gap-1">
                                                    <span className="text-white/30 text-xs">≈</span>
                                                    <span className="text-white font-semibold tabular-nums">
                                                        {Math.round(baseCost).toLocaleString()}
                                                    </span>
                                                    <span className="text-muted text-xs uppercase">{config.baseCurrency}</span>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Dialog */}
            {auth && (
                <TransferDialog
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    currencies={config.currencies}
                    accounts={config.accounts}
                    baseCurrency={config.baseCurrency}
                    getFiatToBaseRate={getFiatToBaseRate}
                />
            )}
        </div>
    );
}

export default Transfers;
