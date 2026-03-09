import {
    type AccountConfig,
    useAppData,
} from "@/hooks/useAppData";
import {
    Plus,
    RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useNotion } from "../../hooks/useNotion";
import {
    createSnapshots,
    updateConfig,
} from "../../lib/notion";
import {
    type AccountPerformance,
    calculatePerformance,
    computeAccountFlows,
} from "../../lib/performance";
import { AccountCard } from "./components/AccountCard";
import { AccountDialog } from "./components/AccountDialog";

export function Accounts() {
    const { config, status, transfers, getFiatToBaseRate, refresh } = useAppData();
    const { auth } = useNotion();

    const [addOpen, setAddOpen] = useState(false);

    const accounts = status === "ready" ? config.accounts : {};

    // Compute performance
    const flows = status === "ready" ? computeAccountFlows(transfers, true, getFiatToBaseRate) : [];
    const accountPerformances: Record<string, AccountPerformance> = {};
    let totalNetCost = 0;
    let totalPL = 0;
    let totalCurrentValue = 0;

    Object.entries(accounts).forEach(([key, acc]) => {
        const perf = calculatePerformance(key, acc.amount ?? null, acc.currency || "USD", flows, getFiatToBaseRate);
        accountPerformances[key] = perf;

        // Only include in totals if it's marked as an investment account
        if (acc.isInvestment !== false) {
            totalNetCost += perf.netCostBase;
            if (perf.plBase != null) totalPL += perf.plBase;
            // Current value in base currency for summary
            const currentValue = perf.netCostBase + (perf.plBase ?? 0);
            totalCurrentValue += currentValue;
        }
    });

    const totalYield = totalNetCost > 0 ? (totalPL / totalNetCost) * 100 : 0;

    const persistAccounts = async (next: Record<string, AccountConfig>) => {
        if (!auth) return;
        await updateConfig(auth.access_token, "accounts", next);
        refresh();
    };

    const handleSaveAccount = async (key: string, cfg: AccountConfig) => {
        const prev = accounts[key];
        const amountChanged = prev && prev.amount !== cfg.amount;

        // Persist to config
        await persistAccounts({ ...accounts, [key]: cfg });

        // If amount changed, record a snapshot
        if (amountChanged && cfg.amount != null && auth) {
            try {
                await createSnapshots(auth.access_token, [{
                    account: key,
                    date: new Date().toISOString(),
                    amount: cfg.amount,
                    currency: cfg.currency || "USD", // Fallback to USD if not set
                }]);
            } catch (err) {
                console.error("Failed to create snapshot:", err);
                // We don't block the UI if snapshot fails
            }
        }
    };

    const handleDelete = async (key: string) => {
        const next = { ...accounts };
        delete next[key];
        await persistAccounts(next);
    };

    const entries = Object.entries(accounts).sort(([keyA, accA], [keyB, accB]) => {
        const amountA = accA.amount ?? -Infinity;
        const amountB = accB.amount ?? -Infinity;
        if (amountB !== amountA) return amountB - amountA;
        const netCostA = Math.abs(accountPerformances[keyA]?.netCostBase ?? 0);
        const netCostB = Math.abs(accountPerformances[keyB]?.netCostBase ?? 0);
        return netCostB - netCostA;
    });

    return (
        <div className="flex min-h-screen flex-col px-4 py-8 max-w-6xl mx-auto">
            <div className="mb-8 flex items-start justify-between">
                <h1 className="text-2xl font-bold text-white">Accounts</h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={refresh}
                        disabled={status === "loading"}
                    >
                        <RefreshCw className={`w-4 h-4 ${status === "loading" ? "animate-spin" : ""}`} />
                    </Button>
                    <Button
                        size="icon"
                        onClick={() => setAddOpen(true)}
                        title="Add Account"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {status === "ready" && entries.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <Card className="p-4 gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Total Cost</span>
                        <span className="text-lg font-bold text-white tabular-nums">{config.baseCurrency} {Math.round(totalNetCost).toLocaleString()}</span>
                    </Card>
                    <Card className="p-4 gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Total Assets</span>
                        <span className="text-lg font-bold text-white tabular-nums">{config.baseCurrency} {Math.round(totalCurrentValue).toLocaleString()}</span>
                    </Card>
                    <Card className="p-4 gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Total P&L</span>
                        <span className={`text-lg font-bold tabular-nums ${totalPL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {config.baseCurrency} {totalPL >= 0 ? "+" : ""}
                            {Math.round(totalPL).toLocaleString()}
                        </span>
                    </Card>
                    <Card className="p-4 gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Overall Yield</span>
                        <span className={`text-lg font-bold tabular-nums ${totalYield >= 0 ? "text-emerald-400" : "text-rose-400/90"}`}>
                            {totalYield >= 0 ? "+" : ""}
                            {totalYield.toFixed(1)}%
                        </span>
                    </Card>
                </div>
            )}

            {status === "loading" && (
                <div className="flex flex-col items-center gap-3 py-16">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                    <p className="text-muted text-sm">Loading accounts...</p>
                </div>
            )}

            {status === "error" && (
                <div className="bg-surface-card border border-red-500/20 rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
                    <span className="text-2xl">❌</span>
                    <p className="text-red-400 text-sm font-medium">Failed to load accounts</p>
                    <Button
                        variant="secondary"
                        onClick={refresh}
                        className="mt-2"
                    >
                        Retry
                    </Button>
                </div>
            )}

            {status === "ready" && (
                <>
                    {entries.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <p className="text-muted text-sm">No accounts yet.</p>
                            <Button
                                variant="link"
                                onClick={() => setAddOpen(true)}
                            >
                                Add your first account &rarr;
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {entries.map(([key, acc]) => (
                                <AccountCard
                                    key={key}
                                    accountKey={key}
                                    config={acc}
                                    baseCurrency={config.baseCurrency}
                                    availableCurrencies={config.currencies}
                                    performance={accountPerformances[key]}
                                    flow={flows.find(f => f.account === key)}
                                    onSaveAccount={handleSaveAccount}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            <AccountDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                editingKey={null}
                existingKeys={Object.keys(accounts)}
                availableCurrencies={config.currencies}
                onSave={handleSaveAccount}
            />
        </div>
    );
}

export default Accounts;
