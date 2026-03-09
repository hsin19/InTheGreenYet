import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card";
import { type AccountConfig } from "@/hooks/useAppData";
import {
    Settings2,
    Trash2,
} from "lucide-react";
import { useState } from "react";
import {
    type AccountFlow,
    type AccountPerformance,
} from "../../../lib/performance";
import { AccountDialog } from "./AccountDialog";
import { InlineAmount } from "./InlineAmount";

interface AccountCardProps {
    accountKey: string;
    config: AccountConfig;
    baseCurrency: string;
    availableCurrencies: string[];
    performance?: AccountPerformance;
    flow?: AccountFlow;
    onSaveAccount: (key: string, config: AccountConfig) => Promise<void>;
    onDelete: (key: string) => Promise<void>;
}

export function AccountCard({
    accountKey,
    config,
    baseCurrency,
    availableCurrencies,
    performance,
    flow,
    onSaveAccount,
    onDelete,
}: AccountCardProps) {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [costExpanded, setCostExpanded] = useState(false);

    const updatedAt = config.amountUpdatedAt
        ? new Date(config.amountUpdatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : null;

    return (
        <>
            <Card className="group hover:border-white/20 hover:bg-surface-card/60 transition-all duration-300 p-0 gap-0 flex flex-col">
                <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-start justify-between gap-2 border-b border-white/10">
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-base leading-tight truncate">
                            {config.displayName}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="p-1.5 rounded text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            aria-label={`Settings for ${accountKey}`}
                        >
                            <Settings2 className="w-3.5 h-3.5" />
                        </button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button
                                    className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                    aria-label={`Delete ${accountKey}`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-surface-card border-white/10 text-white">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-white">Delete "{accountKey}"?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted">
                                        This will remove the account from your config. Existing transfers referencing this account won't be affected.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="border-white/10 text-muted hover:text-white bg-transparent">
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => onDelete(accountKey)}
                                        className="bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardHeader>

                <CardContent className="px-4 pb-5 pt-5 flex flex-col gap-5 justify-end flex-1">
                    {performance && (
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-end">
                                <button
                                    onClick={() => flow && setCostExpanded(v => !v)}
                                    className={`flex flex-col gap-0.5 text-left ${flow ? "cursor-pointer" : "cursor-default"}`}
                                >
                                    <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Net Cost</span>
                                    <span className={`text-xs tabular-nums transition-colors ${flow ? "hover:text-white" : ""}`}>
                                        {costExpanded && flow
                                            ? <span className="flex flex-wrap gap-x-2">
                                                {flow.summary
                                                    .filter(c => Math.round(c.net) !== 0)
                                                    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
                                                    .map(c => (
                                                        <span key={c.currency} className={c.net >= 0 ? "text-white/80" : "text-rose-400/70"}>
                                                            {c.net >= 0 ? "+" : ""}{Math.round(c.net).toLocaleString()} {c.currency}
                                                        </span>
                                                    ))
                                                }
                                            </span>
                                            : <span className="text-white/80">{config.currency || baseCurrency} {Math.round(performance.netCost).toLocaleString()}</span>
                                        }
                                    </span>
                                </button>
                                {config.isInvestment !== false && (
                                    <div className="flex flex-col items-end gap-0.5">
                                        <div className="flex items-baseline gap-1.5">
                                            {updatedAt && <span className="text-muted/40 text-[10px]">{updatedAt}</span>}
                                            <InlineAmount accountKey={accountKey} config={config} onSave={onSaveAccount} large />
                                        </div>
                                    </div>
                                )}
                            </div>
                            {config.isInvestment !== false ? (
                                <div className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded-md border border-white/10 shadow-inner">
                                    <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Net P&L</span>
                                    <span className={`text-xs font-bold tabular-nums ${(performance.pl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {performance.pl != null
                                            ? <>
                                                {config.currency || baseCurrency} {performance.pl >= 0 ? "+" : ""}{Math.round(performance.pl).toLocaleString()}
                                                {performance.yieldPercentage != null && (
                                                    <span className="ml-1 opacity-70">
                                                        ({performance.yieldPercentage >= 0 ? "+" : ""}{performance.yieldPercentage.toFixed(1)}%)
                                                    </span>
                                                )}
                                            </>
                                            : "—"}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center bg-white/5 px-2 py-1.5 rounded-md border border-white/10">
                                    <span className="text-[10px] text-muted/60 uppercase tracking-wider font-semibold">Cash Account</span>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AccountDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                editingKey={accountKey}
                existingConfig={config}
                existingKeys={[]}
                availableCurrencies={availableCurrencies}
                onSave={onSaveAccount}
            />
        </>
    );
}
