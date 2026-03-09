import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { type AccountConfig } from "@/hooks/useAppData";
import {
    useEffect,
    useState,
} from "react";

interface AccountDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null = create mode, string = edit mode (existing key) */
    editingKey: string | null;
    existingConfig?: AccountConfig;
    existingKeys: string[];
    availableCurrencies: string[];
    onSave: (key: string, config: AccountConfig) => Promise<void>;
}

export function AccountDialog({
    open,
    onOpenChange,
    editingKey,
    existingConfig,
    existingKeys,
    availableCurrencies,
    onSave,
}: AccountDialogProps) {
    const isCreate = editingKey === null;

    const [key, setKey] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [currency, setCurrency] = useState("");
    const [accountType, setAccountType] = useState("bank");
    const [isInvestment, setIsInvestment] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (isCreate) {
            setKey("");
            setDisplayName("");
            setCurrency("");
            setAccountType("bank");
        } else {
            setKey(editingKey ?? "");
            setDisplayName(existingConfig?.displayName ?? "");
            setCurrency(existingConfig?.currency ?? "");
            setAccountType(existingConfig?.accountType ?? "bank");
            setIsInvestment(existingConfig?.isInvestment ?? true);
        }
        setError(null);
        setSaving(false);
    }, [open, isCreate, editingKey, existingConfig]);

    const handleSave = async () => {
        const trimmedKey = isCreate ? key.trim() : editingKey!;
        const trimmedName = displayName.trim() || trimmedKey;

        if (isCreate && !trimmedKey) {
            setError("Key is required");
            return;
        }
        if (isCreate && existingKeys.includes(trimmedKey)) {
            setError(`Key "${trimmedKey}" already exists`);
            return;
        }

        if (!currency) {
            setError("Currency is required");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await onSave(trimmedKey, {
                ...(existingConfig ?? {}),
                displayName: trimmedName,
                currency: currency,
                accountType: accountType,
                isInvestment: isInvestment,
            });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-surface/80 backdrop-blur-3xl border border-white/20 text-white sm:max-w-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-6 gap-6 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-white">
                        {isCreate ? "Add Account" : `Edit "${editingKey}"`}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-2">
                    {isCreate && (
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted">Key</label>
                            <Input
                                value={key}
                                onChange={e => setKey(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleSave()}
                                placeholder="e.g. binance"
                                className="bg-surface/50 border-white/5 text-white placeholder:text-muted/50 focus-visible:ring-1 focus-visible:ring-white/20"
                                autoFocus
                            />
                            <p className="text-muted/50 text-xs">Identifier used in transfers. Cannot be changed later.</p>
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted">Display Name</label>
                        <Input
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSave()}
                            placeholder={isCreate ? key || "Display name" : editingKey ?? ""}
                            className="bg-surface/50 border-white/5 text-white placeholder:text-muted/50 focus-visible:ring-1 focus-visible:ring-white/20"
                            autoFocus={!isCreate}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted">Currency</label>
                        <Select
                            value={currency}
                            onValueChange={val => setCurrency(val)}
                        >
                            <SelectTrigger className="bg-surface/50 border-white/5 text-white focus:ring-1 focus:ring-white/20">
                                <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                {availableCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted">Account Type</label>
                        <Select
                            value={accountType}
                            onValueChange={val => setAccountType(val)}
                        >
                            <SelectTrigger className="bg-surface/50 border-white/5 text-white focus:ring-1 focus:ring-white/20">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                <SelectItem value="bank">Bank</SelectItem>
                                <SelectItem value="binance">Binance</SelectItem>
                                <SelectItem value="okx">OKX</SelectItem>
                                <SelectItem value="max">MAX</SelectItem>
                                <SelectItem value="bitget">Bitget</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <input
                            type="checkbox"
                            role="checkbox"
                            id="isInvestment"
                            checked={isInvestment}
                            onChange={e => setIsInvestment(e.target.checked)}
                            className="w-4 h-4 rounded appearance-none border border-white/10 bg-surface/50 checked:bg-green-500 checked:border-green-500 cursor-pointer transition-colors relative after:content-['✓'] after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-[10px] after:text-black after:font-bold after:opacity-0 checked:after:opacity-100"
                        />
                        <label htmlFor="isInvestment" className="text-xs text-muted cursor-pointer select-none">
                            Include in portfolio totals?
                        </label>
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}
                </div>

                <DialogFooter className="pt-2">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : isCreate ? "Add" : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
