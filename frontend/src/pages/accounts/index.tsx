import { Plus } from "lucide-react";
import {
    useEffect,
    useState,
} from "react";
import {
    type AccountConfig,
    useAppData,
} from "../../hooks/useAppData";
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
    const { config, status, transfers, refresh } = useAppData();
    const { auth } = useNotion();

    const [accounts, setAccounts] = useState<Record<string, AccountConfig>>({});
    const [addOpen, setAddOpen] = useState(false);

    useEffect(() => {
        if (status === "ready") {
            setAccounts(config.accounts);
        }
    }, [status, config.accounts]);

    // Compute performance
    const flows = status === "ready" ? computeAccountFlows(transfers, true) : [];
    const accountPerformances: Record<string, AccountPerformance> = {};
    let totalNetCost = 0;
    let totalPL = 0;
    let totalCurrentValue = 0;

    Object.entries(accounts).forEach(([key, acc]) => {
        const perf = calculatePerformance(key, acc.amount ?? null, acc.currency || "USD", flows);
        accountPerformances[key] = perf;

        // Only include in totals if it's marked as an investment account
        if (acc.isInvestment !== false) {
            totalNetCost += perf.netCostTwd;
            if (perf.plTwd != null) totalPL += perf.plTwd;
            // Current value in TWD for summary
            const currentValue = perf.netCostTwd + (perf.plTwd ?? 0);
            totalCurrentValue += currentValue;
        }
    });

    const totalYield = totalNetCost > 0 ? (totalPL / totalNetCost) * 100 : 0;

    const persistAccounts = async (next: Record<string, AccountConfig>) => {
        if (!auth) return;
        await updateConfig(auth.access_token, "accounts", next);
        setAccounts(next);
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

    const entries = Object.entries(accounts);

    return (
        <div className="flex min-h-screen flex-col px-4 py-8 max-w-6xl mx-auto">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Accounts</h1>
                    <p className="text-muted text-sm mt-1">Track balances across your accounts</p>
                </div>
                <button
                    onClick={() => setAddOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-sm hover:bg-green-500/25 transition-colors cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    Add Account
                </button>
            </div>

            {status === "ready" && entries.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <div className="bg-surface-card border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Total Cost</span>
                        <span className="text-lg font-bold text-white tabular-nums">NT$ {Math.round(totalNetCost).toLocaleString()}</span>
                    </div>
                    <div className="bg-surface-card border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Total Assets</span>
                        <span className="text-lg font-bold text-white tabular-nums">NT$ {Math.round(totalCurrentValue).toLocaleString()}</span>
                    </div>
                    <div className="bg-surface-card border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Total P&L</span>
                        <span className={`text-lg font-bold tabular-nums ${totalPL >= 0 ? "text-green-400" : "text-red-400"}`}>
                            NT$ {totalPL >= 0 ? "+" : ""}
                            {Math.round(totalPL).toLocaleString()}
                        </span>
                    </div>
                    <div className="bg-surface-card border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Overall Yield</span>
                        <span className={`text-lg font-bold tabular-nums ${totalYield >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {totalYield >= 0 ? "+" : ""}
                            {totalYield.toFixed(1)}%
                        </span>
                    </div>
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
                    <button
                        onClick={refresh}
                        className="px-4 py-2 bg-surface border border-white/10 rounded-lg text-sm text-white hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {status === "ready" && (
                <>
                    {entries.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <p className="text-muted text-sm">No accounts yet.</p>
                            <button
                                onClick={() => setAddOpen(true)}
                                className="text-green-400 text-sm hover:underline cursor-pointer"
                            >
                                Add your first account →
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {entries.map(([key, acc]) => (
                                <AccountCard
                                    key={key}
                                    accountKey={key}
                                    config={acc}
                                    availableCurrencies={config.currencies}
                                    performance={accountPerformances[key]}
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
