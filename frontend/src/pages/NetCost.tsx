import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAppData } from "../hooks/useAppData";
import type { Transfer } from "../lib/notion";

interface CurrencyFlow {
    currency: string;
    inflow: number;
    outflow: number;
    net: number;
    twdInflow: number;
    twdOutflow: number;
}

interface AccountRecord {
    date: string | null;
    counterpart: string;
    amount: number;
    currency: string;
    direction: "in" | "out";
}

interface AccountFlow {
    account: string;
    summary: CurrencyFlow[];
    details: CurrencyFlow[];
    records: AccountRecord[];
    twdNet: number;
    hasAllRates: boolean;
}

const STABLE_USD = new Set(["USD", "USDT", "USDC"]);

type FlowEntry = { inflow: number; outflow: number; twdInflow: number; twdOutflow: number; hasRate: boolean; };

function computeFlows(transfers: Transfer[], mergeUsd: boolean): AccountFlow[] {
    const raw: Record<string, Record<string, FlowEntry>> = {};
    const records: Record<string, AccountRecord[]> = {};

    const ensure = (map: Record<string, Record<string, FlowEntry>>, account: string, currency: string) => {
        if (!map[account]) map[account] = {};
        if (!map[account][currency]) map[account][currency] = { inflow: 0, outflow: 0, twdInflow: 0, twdOutflow: 0, hasRate: true };
        if (!records[account]) records[account] = [];
    };

    const toTwd = (amount: number, currency: string, exchangeRate: number | null): { twd: number; hasRate: boolean; } => {
        if (currency === "TWD") return { twd: amount, hasRate: true };
        if (exchangeRate != null) return { twd: amount * exchangeRate, hasRate: true };
        return { twd: 0, hasRate: false };
    };

    for (const t of transfers) {
        const amount = t.amount ?? 0;
        const fee = t.fee ?? 0;
        const currency = t.currency || "unknown";

        if (t.from) {
            ensure(raw, t.from, currency);
            const entry = raw[t.from][currency];
            entry.outflow += amount + fee;
            const { twd, hasRate } = toTwd(amount + fee, currency, t.exchangeRate);
            entry.twdOutflow += twd;
            if (!hasRate) entry.hasRate = false;
            records[t.from].push({ date: t.date, counterpart: t.to || "—", amount: amount + fee, currency, direction: "out" });
        }
        if (t.to) {
            ensure(raw, t.to, currency);
            const entry = raw[t.to][currency];
            entry.inflow += amount;
            const { twd, hasRate } = toTwd(amount, currency, t.exchangeRate);
            entry.twdInflow += twd;
            if (!hasRate) entry.hasRate = false;
            records[t.to].push({ date: t.date, counterpart: t.from || "—", amount, currency, direction: "in" });
        }
    }

    const toFlows = (byCurrency: Record<string, FlowEntry>): CurrencyFlow[] =>
        Object.entries(byCurrency).map(([currency, v]) => ({
            currency,
            inflow: v.inflow,
            outflow: v.outflow,
            net: v.inflow - v.outflow,
            twdInflow: v.twdInflow,
            twdOutflow: v.twdOutflow,
        }));

    const mergeCurrencies = (entries: Record<string, FlowEntry>): Record<string, FlowEntry> => {
        if (!mergeUsd) return entries;
        const merged: Record<string, FlowEntry> = {};
        for (const [currency, v] of Object.entries(entries)) {
            const key = STABLE_USD.has(currency) ? "USD" : currency;
            if (!merged[key]) merged[key] = { inflow: 0, outflow: 0, twdInflow: 0, twdOutflow: 0, hasRate: true };
            merged[key].inflow += v.inflow;
            merged[key].outflow += v.outflow;
            merged[key].twdInflow += v.twdInflow;
            merged[key].twdOutflow += v.twdOutflow;
            if (!v.hasRate) merged[key].hasRate = false;
        }
        return merged;
    };

    return Object.entries(raw)
        .map(([account, byCurrency]) => {
            const details = toFlows(byCurrency);
            const mergedMap = mergeCurrencies(byCurrency);
            const summary = toFlows(mergedMap);
            const hasAllRates = Object.values(byCurrency).every(v => v.hasRate);
            const twdNet = details.reduce((sum, c) => sum + c.twdInflow - c.twdOutflow, 0);
            const sorted = (records[account] || []).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
            return { account, summary, details, records: sorted, twdNet, hasAllRates };
        })
        .sort((a, b) => a.account.localeCompare(b.account));
}

function formatNet(currencies: CurrencyFlow[]): { parts: { value: string; currency: string; }[]; isPositive: boolean; } {
    const nonZero = currencies.filter(c => c.net !== 0);
    if (nonZero.length === 0) return { parts: [{ value: "0", currency: "" }], isPositive: true };

    const totalTwd = nonZero.reduce((s, c) => s + c.twdInflow - c.twdOutflow, 0);
    const isPositive = totalTwd >= 0;

    const parts = nonZero.map((c, i) => {
        const abs = Math.abs(c.net);
        const sign = c.net >= 0 ? "+" : "-";
        const prefix = i === 0 ? (c.net < 0 ? "-" : "") : ` ${sign} `;
        return {
            value: `${prefix}${abs.toLocaleString()}`,
            currency: c.currency,
        };
    });

    return { parts, isPositive };
}

function NetCost() {
    const { status, transfers, error, refresh, getAccountName } = useAppData();
    const [mergeUsd, setMergeUsd] = useState(true);
    const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

    const toggleExpand = (account: string) =>
        setExpandedAccounts(prev => {
            const next = new Set(prev);
            if (next.has(account)) {
                next.delete(account);
            } else {
                next.add(account);
            }
            return next;
        });

    const flows = status === "ready" ? computeFlows(transfers, mergeUsd) : [];

    return (
        <div className="flex min-h-screen flex-col px-4 py-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-white">Net Cost</h1>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={mergeUsd}
                            onChange={e => setMergeUsd(e.target.checked)}
                            className="accent-green-500"
                        />
                        USDT/USDC as USD
                    </label>
                    <button
                        onClick={refresh}
                        disabled={status === "loading"}
                        className="p-1.5 text-muted hover:text-white border border-white/10 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {status === "loading" && (
                <div className="flex flex-col items-center gap-3 py-16">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                    <p className="text-muted text-sm">Loading...</p>
                </div>
            )}

            {status === "error" && (
                <div className="bg-surface-card border border-red-500/20 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg shadow-red-500/5">
                    <span className="text-2xl">❌</span>
                    <p className="text-red-400 text-sm font-medium">Failed to load data</p>
                    <p className="text-muted text-xs">{error}</p>
                    <button
                        onClick={refresh}
                        className="mt-2 px-4 py-2 bg-surface border border-white/10 rounded-lg text-sm text-white hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {status === "ready" && flows.length === 0 && (
                <div className="bg-surface-card border border-white/10 rounded-2xl px-8 py-8 flex flex-col items-center gap-2 shadow-lg">
                    <p className="text-white font-medium">No transfers yet</p>
                    <p className="text-muted text-sm">Add transfers to see net cost per account.</p>
                </div>
            )}

            {status === "ready" && flows.length > 0 && (
                <div className="flex flex-col gap-4">
                    {flows.map(({ account, summary, details, records, twdNet, hasAllRates }) => {
                        const { parts, isPositive } = formatNet(summary);
                        const isExpanded = expandedAccounts.has(account);
                        return (
                            <div
                                key={account}
                                className="bg-surface-card border border-white/10 rounded-2xl shadow-sm overflow-hidden"
                            >
                                {/* Header: clickable */}
                                <button
                                    onClick={() => toggleExpand(account)}
                                    className="w-full text-left px-5 py-4 flex items-start gap-3 cursor-pointer"
                                >
                                    <h2 className="text-white font-bold text-xl flex-1">{getAccountName(account)}</h2>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-xl font-bold tabular-nums ${isPositive ? "text-green-400" : "text-red-400"}`}>
                                            {parts.map((p, i) => (
                                                <span key={i}>
                                                    {p.value}
                                                    {p.currency && <span className="text-sm font-normal text-muted ml-1">{p.currency}</span>}
                                                </span>
                                            ))}
                                        </span>
                                        <span className="text-muted text-xs tabular-nums">
                                            {hasAllRates
                                                ? `NT$ ${Math.round(twdNet).toLocaleString()}`
                                                : "NT$ —"}
                                        </span>
                                    </div>
                                </button>

                                {/* Expanded: records + summary */}
                                {isExpanded && (
                                    <div className="px-5 pb-4 border-t border-white/5">
                                        {/* Records */}
                                        <div className="flex flex-col gap-1 py-3">
                                            {records.map((r, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted/50 tabular-nums w-20">{r.date ?? "—"}</span>
                                                        <span className="text-muted">{r.direction === "in" ? `from ${getAccountName(r.counterpart)}` : `to ${getAccountName(r.counterpart)}`}</span>
                                                    </div>
                                                    <span className={`tabular-nums font-medium ${r.direction === "in" ? "text-green-400/80" : "text-red-400/80"}`}>
                                                        {r.direction === "in" ? "+" : "-"}
                                                        {r.amount.toLocaleString()} {r.currency}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Summary */}
                                        <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
                                            {details.map(({ currency, inflow, outflow, net }) => (
                                                <div key={currency} className="flex items-center justify-between text-xs">
                                                    <span className="text-muted">{currency}</span>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-green-400/70 tabular-nums">
                                                            +{inflow.toLocaleString()}
                                                        </span>
                                                        <span className="text-red-400/70 tabular-nums">
                                                            -{outflow.toLocaleString()}
                                                        </span>
                                                        <span className={`font-medium tabular-nums w-24 text-right ${net >= 0 ? "text-green-400/90" : "text-red-400/90"}`}>
                                                            {net >= 0 ? "+" : ""}
                                                            {net.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default NetCost;
