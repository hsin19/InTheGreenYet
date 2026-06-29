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
import {
    type AccountConfig,
    useAppData,
} from "@/hooks/useAppData";
import { type CreateTransferInput } from "@/lib/model";
import {
    Trans,
    useLingui,
} from "@lingui/react/macro";
import { useState } from "react";

const todayISO = () => new Date().toLocaleDateString("sv-SE");

const emptyForm = (): CreateTransferInput => ({
    title: "",
    amount: null,
    currency: null,
    fee: null,
    exchangeRate: null,
    date: todayISO(),
    from: "",
    to: "",
    note: "",
});

interface TransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currencies: string[];
    accounts: Record<string, AccountConfig>;
    baseCurrency: string;
    getFiatToBaseRate: (currency: string) => number | null;
}

export function TransferDialog({
    open,
    onOpenChange,
    currencies,
    accounts,
    baseCurrency,
    getFiatToBaseRate,
}: TransferDialogProps) {
    const { addTransfer } = useAppData();
    const [form, setForm] = useState<CreateTransferInput>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useLingui();

    const set = <K extends keyof CreateTransferInput>(key: K, value: CreateTransferInput[K]) => setForm(prev => ({ ...prev, [key]: value }));

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setForm(emptyForm());
            setError(null);
            setSaving(false);
        }
        onOpenChange(next);
    };

    const handleSave = async () => {
        if (!form.from) {
            setError(t`From is required`);
            return;
        }
        if (!form.to) {
            setError(t`To is required`);
            return;
        }
        if (form.amount == null) {
            setError(t`Amount is required`);
            return;
        }
        if (!form.currency) {
            setError(t`Currency is required`);
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const title = form.title.trim() || t`${form.from || "?"} to ${form.to || "?"}`;
            await addTransfer({ ...form, title });
            handleOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : t`Failed to save`);
        } finally {
            setSaving(false);
        }
    };

    const accountEntries = Object.entries(accounts);
    const hasAccounts = accountEntries.length > 0;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="bg-surface/80 backdrop-blur-3xl border border-white/20 text-white sm:max-w-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-6 gap-6 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-white">
                        <Trans>New Transfer</Trans>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-2">
                    {/* Title */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="transfer-title" className="text-xs text-muted">
                            <Trans>Title</Trans>
                        </label>
                        <Input
                            id="transfer-title"
                            value={form.title}
                            onChange={e => set("title", e.target.value)}
                            placeholder={t`${form.from || "?"} to ${form.to || "?"}`}
                            className="bg-white/8 border-white/15 text-white placeholder:text-muted/50"
                        />
                    </div>

                    {/* Date */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="transfer-date" className="text-xs text-muted">
                            <Trans>Date</Trans> <span className="text-red-400">*</span>
                        </label>
                        <Input
                            id="transfer-date"
                            type="date"
                            value={form.date ?? ""}
                            onChange={e => set("date", e.target.value || null)}
                            className="bg-white/8 border-white/15 text-white placeholder:text-muted/50 [color-scheme:dark]"
                        />
                    </div>

                    {/* From / To */}
                    <div className="flex gap-3">
                        <div className="flex flex-col gap-1 flex-1">
                            <label htmlFor="transfer-from" className="text-xs text-muted">
                                <Trans>From</Trans> <span className="text-red-400">*</span>
                            </label>
                            {hasAccounts ? (
                                <Select value={form.from} onValueChange={val => set("from", val)}>
                                    <SelectTrigger id="transfer-from" className="bg-white/8 border-white/15 text-white">
                                        <SelectValue placeholder={t`Select`} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                        {accountEntries.map(([key, a]) => <SelectItem key={key} value={key}>{a.displayName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="transfer-from"
                                    value={form.from}
                                    onChange={e => set("from", e.target.value)}
                                    placeholder={t`Source`}
                                    className="bg-white/8 border-white/15 text-white placeholder:text-muted/50"
                                />
                            )}
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <label htmlFor="transfer-to" className="text-xs text-muted">
                                <Trans>To</Trans> <span className="text-red-400">*</span>
                            </label>
                            {hasAccounts ? (
                                <Select value={form.to} onValueChange={val => set("to", val)}>
                                    <SelectTrigger id="transfer-to" className="bg-white/8 border-white/15 text-white">
                                        <SelectValue placeholder={t`Select`} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                        {accountEntries.map(([key, a]) => <SelectItem key={key} value={key}>{a.displayName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="transfer-to"
                                    value={form.to}
                                    onChange={e => set("to", e.target.value)}
                                    placeholder={t`Destination`}
                                    className="bg-white/8 border-white/15 text-white placeholder:text-muted/50"
                                />
                            )}
                        </div>
                    </div>

                    {/* Amount / Currency */}
                    <div className="flex gap-3">
                        <div className="flex flex-col gap-1 flex-1">
                            <label htmlFor="transfer-amount" className="text-xs text-muted">
                                <Trans>Amount</Trans> <span className="text-red-400">*</span>
                            </label>
                            <Input
                                id="transfer-amount"
                                type="number"
                                step="any"
                                value={form.amount ?? ""}
                                onChange={e => set("amount", e.target.value ? Number(e.target.value) : null)}
                                placeholder="0"
                                className="bg-white/8 border-white/15 text-white placeholder:text-muted/50"
                            />
                        </div>
                        <div className="flex flex-col gap-1 w-28">
                            <label htmlFor="transfer-currency" className="text-xs text-muted">
                                <Trans>Currency</Trans> <span className="text-red-400">*</span>
                            </label>
                            <Select
                                value={form.currency ?? ""}
                                onValueChange={val => set("currency", val || null)}
                            >
                                <SelectTrigger id="transfer-currency" className="bg-white/8 border-white/15 text-white">
                                    <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                    {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Fee / Exchange Rate */}
                    {(() => {
                        const refRate = form.currency && form.currency !== baseCurrency
                            ? getFiatToBaseRate(form.currency)
                            : null;
                        return (
                            <div className="flex gap-3">
                                <div className="flex flex-col gap-1 flex-1">
                                    <label htmlFor="transfer-fee" className="text-xs text-muted">
                                        <Trans>Fee</Trans>
                                    </label>
                                    <Input
                                        id="transfer-fee"
                                        type="number"
                                        step="any"
                                        value={form.fee ?? ""}
                                        onChange={e => set("fee", e.target.value ? Number(e.target.value) : null)}
                                        placeholder="0"
                                        className="bg-white/8 border-white/15 text-white placeholder:text-muted/50"
                                    />
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <div className="flex items-baseline justify-between gap-1">
                                        <label htmlFor="transfer-rate" className="text-xs text-muted">
                                            <Trans>Exchange Rate</Trans>
                                        </label>
                                        {refRate != null && (
                                            <span className="text-xs text-blue-400/70 tabular-nums">
                                                <Trans>ref {refRate.toFixed(4)}</Trans>
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        id="transfer-rate"
                                        type="number"
                                        step="any"
                                        value={form.exchangeRate ?? ""}
                                        onChange={e => set("exchangeRate", e.target.value ? Number(e.target.value) : null)}
                                        placeholder={refRate != null ? refRate.toFixed(4) : "1"}
                                        className="bg-white/8 border-white/15 text-white placeholder:text-muted/50"
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* Note */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="transfer-note" className="text-xs text-muted">
                            <Trans>Note</Trans>
                        </label>
                        <textarea
                            id="transfer-note"
                            value={form.note}
                            onChange={e => set("note", e.target.value)}
                            placeholder={t`Optional note`}
                            rows={2}
                            className="w-full bg-white/8 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
                        />
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}
                </div>

                <DialogFooter className="pt-2">
                    <Button
                        variant="ghost"
                        onClick={() => handleOpenChange(false)}
                        disabled={saving}
                    >
                        <Trans>Cancel</Trans>
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
