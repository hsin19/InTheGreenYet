import {
    type AccountConfig,
    useAppData,
} from "@/hooks/useAppData";
import {
    Trans,
    useLingui,
} from "@lingui/react/macro";
import {
    AlertCircle,
    Plus,
    RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
    type AccountPerformance,
    calculatePerformance,
    computeAccountFlows,
    sortAccountKeys,
} from "../../lib/performance";
import { AccountCard } from "./components/AccountCard";
import { AccountDialog } from "./components/AccountDialog";

export function Accounts() {
    const { config, status, transfers, getFiatToBaseRate, refresh, saveConfig, addSnapshots } = useAppData();
    const { t } = useLingui();

    const [addOpen, setAddOpen] = useState(false);
    const [dialogKey, setDialogKey] = useState(0);
    const openAddDialog = () => {
        setDialogKey(k => k + 1);
        setAddOpen(true);
    };

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
        await saveConfig("accounts", next);
    };

    const handleSaveAccount = async (key: string, cfg: AccountConfig) => {
        const prev = accounts[key];
        const amountChanged = prev && prev.amount !== cfg.amount;

        // Persist to config
        await persistAccounts({ ...accounts, [key]: cfg });

        // If amount changed, record a snapshot
        if (amountChanged && cfg.amount != null) {
            try {
                await addSnapshots([{
                    account: key,
                    date: new Date().toLocaleDateString("sv-SE"),
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

    const sortedKeys = sortAccountKeys(accounts, accountPerformances);

    return (
        <div className="flex min-h-full flex-col px-4 py-8 max-w-6xl mx-auto">
            <div className="mb-8 flex items-start justify-between">
                <h1 className="text-2xl font-bold text-white text-pretty">
                    <Trans>Accounts</Trans>
                </h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={refresh}
                        disabled={status === "loading"}
                        aria-label={t`Refresh accounts`}
                        title={t`Refresh`}
                    >
                        <RefreshCw className={`w-4 h-4 ${status === "loading" ? "animate-spin" : ""}`} />
                    </Button>
                    <Button
                        size="icon"
                        onClick={openAddDialog}
                        aria-label={t`Add account`}
                        title={t`Add account`}
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {status === "ready" && sortedKeys.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <Card className="p-4 gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                            <Trans>Total Cost</Trans>
                        </span>
                        <span className="text-lg font-bold text-white tabular-nums">{config.baseCurrency} {Math.round(totalNetCost).toLocaleString()}</span>
                    </Card>
                    <Card className="p-4 gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                            <Trans>Total Assets</Trans>
                        </span>
                        <span className="text-lg font-bold text-white tabular-nums">{config.baseCurrency} {Math.round(totalCurrentValue).toLocaleString()}</span>
                    </Card>
                    <Card className="p-4 gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                            <Trans>Total P&L</Trans>
                        </span>
                        <span className={`text-lg font-bold tabular-nums ${totalPL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {config.baseCurrency} {totalPL >= 0 ? "+" : ""}
                            {Math.round(totalPL).toLocaleString()}
                        </span>
                    </Card>
                    <Card className="p-4 gap-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                            <Trans>Overall Yield</Trans>
                        </span>
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
                    <p className="text-muted text-sm">
                        <Trans>Loading accounts…</Trans>
                    </p>
                </div>
            )}

            {status === "error" && (
                <div className="bg-surface-card border border-red-500/20 rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
                    <AlertCircle className="size-7 text-rose-400" aria-hidden="true" />
                    <p className="text-red-400 text-sm font-medium">
                        <Trans>Failed to load accounts</Trans>
                    </p>
                    <Button
                        variant="secondary"
                        onClick={refresh}
                        className="mt-2"
                    >
                        <Trans>Retry</Trans>
                    </Button>
                </div>
            )}

            {status === "ready" && (
                <>
                    {sortedKeys.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <p className="text-muted text-sm">
                                <Trans>No accounts yet.</Trans>
                            </p>
                            <Button
                                variant="link"
                                onClick={openAddDialog}
                            >
                                <Trans>Add your first account &rarr;</Trans>
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {sortedKeys.map(key => (
                                <AccountCard
                                    key={key}
                                    accountKey={key}
                                    config={accounts[key]}
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
                key={dialogKey}
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
