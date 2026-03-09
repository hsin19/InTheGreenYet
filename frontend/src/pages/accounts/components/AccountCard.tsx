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
import { type AccountPerformance } from "../../../lib/performance";
import { AccountDialog } from "./AccountDialog";
import { InlineAmount } from "./InlineAmount";

interface AccountCardProps {
    accountKey: string;
    config: AccountConfig;
    baseCurrency: string;
    availableCurrencies: string[];
    performance?: AccountPerformance;
    onSaveAccount: (key: string, config: AccountConfig) => Promise<void>;
    onDelete: (key: string) => Promise<void>;
}

export function AccountCard({
    accountKey,
    config,
    baseCurrency,
    availableCurrencies,
    performance,
    onSaveAccount,
    onDelete,
}: AccountCardProps) {
    const [settingsOpen, setSettingsOpen] = useState(false);

    const updatedAt = config.amountUpdatedAt
        ? new Date(config.amountUpdatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : null;

    return (
        <>
            <Card className="group hover:border-white/20 hover:bg-surface-card/60 transition-all duration-300 p-0 gap-0">
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

                <CardContent className="px-4 pb-4 pt-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <InlineAmount accountKey={accountKey} config={config} onSave={onSaveAccount} />
                        {updatedAt && <p className="text-muted/50 text-xs">Updated {updatedAt}</p>}
                    </div>

                    {performance && (
                        <div className="pt-3 flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Net Cost</span>
                                    <span className="text-xs text-white/80 tabular-nums">
                                        {config.currency || baseCurrency} {Math.round(performance.netCost).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Yield</span>
                                    <span className={`text-xs font-bold tabular-nums ${(performance.yieldPercentage ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400/90"}`}>
                                        {performance.yieldPercentage != null
                                            ? `${performance.yieldPercentage >= 0 ? "+" : ""}${performance.yieldPercentage.toFixed(1)}%`
                                            : "—"}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded-md border border-white/10 shadow-inner">
                                <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Net P&L</span>
                                <span className={`text-xs font-bold tabular-nums ${(performance.pl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {performance.pl != null
                                        ? `${config.currency || baseCurrency} ${performance.pl >= 0 ? "+" : ""}${Math.round(performance.pl).toLocaleString()}`
                                        : "—"}
                                </span>
                            </div>
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
