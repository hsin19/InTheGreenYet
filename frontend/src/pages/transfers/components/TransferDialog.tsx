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
    createTransfer,
    type CreateTransferInput,
} from "@/lib/notion";
import { useState } from "react";

const todayISO = () => new Date().toISOString().slice(0, 10);

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
    token: string;
    currencies: string[];
    accounts: Record<string, AccountConfig>;
    onCreated: () => void;
}

export function TransferDialog({
    open,
    onOpenChange,
    token,
    currencies,
    accounts,
    onCreated,
}: TransferDialogProps) {
    const [form, setForm] = useState<CreateTransferInput>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            setError("From is required");
            return;
        }
        if (!form.to) {
            setError("To is required");
            return;
        }
        if (form.amount == null) {
            setError("Amount is required");
            return;
        }
        if (!form.currency) {
            setError("Currency is required");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const title = form.title.trim() || `${form.from || "?"} to ${form.to || "?"}`;
            await createTransfer(token, { ...form, title });
            onCreated();
            handleOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
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
                        New Transfer
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-2">
                    {/* Title */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted">Title</label>
                        <Input
                            value={form.title}
                            onChange={e => set("title", e.target.value)}
                            placeholder={`${form.from || "?"} to ${form.to || "?"}`}
                            className="bg-surface/50 border-white/5 text-white placeholder:text-muted/50 focus-visible:ring-1 focus-visible:ring-white/20"
                        />
                    </div>

                    {/* Date */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted">Date</label>
                        <Input
                            type="date"
                            value={form.date ?? ""}
                            onChange={e => set("date", e.target.value || null)}
                            className="bg-surface/50 border-white/5 text-white placeholder:text-muted/50 focus-visible:ring-1 focus-visible:ring-white/20 [color-scheme:dark]"
                        />
                    </div>

                    {/* From / To */}
                    <div className="flex gap-3">
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs text-muted">From</label>
                            {hasAccounts ? (
                                <Select value={form.from} onValueChange={val => set("from", val)}>
                                    <SelectTrigger className="bg-surface/50 border-white/5 text-white focus:ring-1 focus:ring-white/20">
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                        {accountEntries.map(([key, a]) => <SelectItem key={key} value={key}>{a.displayName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={form.from}
                                    onChange={e => set("from", e.target.value)}
                                    placeholder="Source"
                                    className="bg-surface/50 border-white/5 text-white placeholder:text-muted/50 focus-visible:ring-1 focus-visible:ring-white/20"
                                />
                            )}
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs text-muted">To</label>
                            {hasAccounts ? (
                                <Select value={form.to} onValueChange={val => set("to", val)}>
                                    <SelectTrigger className="bg-surface/50 border-white/5 text-white focus:ring-1 focus:ring-white/20">
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                        {accountEntries.map(([key, a]) => <SelectItem key={key} value={key}>{a.displayName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={form.to}
                                    onChange={e => set("to", e.target.value)}
                                    placeholder="Destination"
                                    className="bg-surface/50 border-white/5 text-white placeholder:text-muted/50 focus-visible:ring-1 focus-visible:ring-white/20"
                                />
                            )}
                        </div>
                    </div>

                    {/* Amount / Currency */}
                    <div className="flex gap-3">
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs text-muted">Amount</label>
                            <Input
                                type="number"
                                step="any"
                                value={form.amount ?? ""}
                                onChange={e => set("amount", e.target.value ? Number(e.target.value) : null)}
                                placeholder="0"
                                className="bg-surface/50 border-white/5 text-white placeholder:text-muted/50 focus-visible:ring-1 focus-visible:ring-white/20"
                            />
                        </div>
                        <div className="flex flex-col gap-1 w-28">
                            <label className="text-xs text-muted">Currency</label>
                            <Select
                                value={form.currency ?? ""}
                                onValueChange={val => set("currency", val || null)}
                            >
                                <SelectTrigger className="bg-surface/50 border-white/5 text-white focus:ring-1 focus:ring-white/20">
                                    <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                    {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Fee / Exchange Rate */}
                    <div className="flex gap-3">
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs text-muted">Fee</label>
                            <Input
                                type="number"
                                step="any"
                                value={form.fee ?? ""}
                                onChange={e => set("fee", e.target.value ? Number(e.target.value) : null)}
                                placeholder="0"
                                className="bg-surface/50 border-white/5 text-white placeholder:text-muted/50 focus-visible:ring-1 focus-visible:ring-white/20"
                            />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs text-muted">Exchange Rate</label>
                            <Input
                                type="number"
                                step="any"
                                value={form.exchangeRate ?? ""}
                                onChange={e => set("exchangeRate", e.target.value ? Number(e.target.value) : null)}
                                placeholder="1"
                                className="bg-surface/50 border-white/5 text-white placeholder:text-muted/50 focus-visible:ring-1 focus-visible:ring-white/20"
                            />
                        </div>
                    </div>

                    {/* Note */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted">Note</label>
                        <textarea
                            value={form.note}
                            onChange={e => set("note", e.target.value)}
                            placeholder="Optional note"
                            rows={2}
                            className="w-full bg-surface/50 border border-white/5 rounded-md px-3 py-2 text-sm text-white placeholder:text-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 resize-none"
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
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
