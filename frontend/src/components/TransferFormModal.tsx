import { useState } from "react";
import {
    createTransfer,
    type CreateTransferInput,
} from "../lib/notion";

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

interface Props {
    token: string;
    currencies: string[];
    accounts: string[];
    onClose: () => void;
    onCreated: () => void;
}

export function TransferFormModal({ token, currencies, accounts, onClose, onCreated }: Props) {
    const [form, setForm] = useState<CreateTransferInput>(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = <K extends keyof CreateTransferInput>(key: K, value: CreateTransferInput[K]) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const title = form.title.trim() || `${form.from || "?"} to ${form.to || "?"}`;
            await createTransfer(token, { ...form, title });
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <form
                onSubmit={handleSubmit}
                className="relative w-full max-w-md bg-surface-card border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-5 px-6 py-6"
            >
                <h2 className="text-white font-semibold text-lg">New Transfer</h2>

                {/* Title */}
                <Field label="Title">
                    <input
                        value={form.title}
                        onChange={e => set("title", e.target.value)}
                        placeholder={`${form.from || "?"} to ${form.to || "?"}`}
                        className={inputCls}
                    />
                </Field>

                {/* Date */}
                <Field label="Date">
                    <input
                        required
                        type="date"
                        value={form.date ?? ""}
                        onChange={e => set("date", e.target.value || null)}
                        className={inputCls}
                    />
                </Field>

                {/* From / To */}
                <div className="flex gap-3">
                    <Field label="From" className="flex-1">
                        {accounts.length > 0 ? (
                            <select
                                required
                                value={form.from}
                                onChange={e => set("from", e.target.value)}
                                className={inputCls}
                            >
                                <option value="">—</option>
                                {accounts.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        ) : (
                            <input
                                required
                                value={form.from}
                                onChange={e => set("from", e.target.value)}
                                placeholder="Source"
                                className={inputCls}
                            />
                        )}
                    </Field>
                    <Field label="To" className="flex-1">
                        {accounts.length > 0 ? (
                            <select
                                required
                                value={form.to}
                                onChange={e => set("to", e.target.value)}
                                className={inputCls}
                            >
                                <option value="">—</option>
                                {accounts.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        ) : (
                            <input
                                required
                                value={form.to}
                                onChange={e => set("to", e.target.value)}
                                placeholder="Destination"
                                className={inputCls}
                            />
                        )}
                    </Field>
                </div>

                {/* Amount / Currency */}
                <div className="flex gap-3">
                    <Field label="Amount" className="flex-1">
                        <input
                            required
                            type="number"
                            step="any"
                            value={form.amount ?? ""}
                            onChange={e => set("amount", e.target.value ? Number(e.target.value) : null)}
                            placeholder="0"
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Currency" className="w-28">
                        <select
                            required
                            value={form.currency ?? ""}
                            onChange={e => set("currency", e.target.value || null)}
                            className={inputCls}
                        >
                            <option value="">—</option>
                            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </Field>
                </div>

                {/* Fee / Exchange Rate */}
                <div className="flex gap-3">
                    <Field label="Fee" className="flex-1">
                        <input
                            type="number"
                            step="any"
                            value={form.fee ?? ""}
                            onChange={e => set("fee", e.target.value ? Number(e.target.value) : null)}
                            placeholder="0"
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Exchange Rate" className="flex-1">
                        <input
                            type="number"
                            step="any"
                            value={form.exchangeRate ?? ""}
                            onChange={e => set("exchangeRate", e.target.value ? Number(e.target.value) : null)}
                            placeholder="1"
                            className={inputCls}
                        />
                    </Field>
                </div>

                {/* Note */}
                <Field label="Note">
                    <textarea
                        value={form.note}
                        onChange={e => set("note", e.target.value)}
                        placeholder="Optional note"
                        rows={2}
                        className={`${inputCls} resize-none`}
                    />
                </Field>

                {error && <p className="text-red-400 text-xs">{error}</p>}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-muted hover:text-white hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {submitting ? "Saving…" : "Save"}
                    </button>
                </div>
            </form>
        </div>
    );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string; }) {
    return (
        <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
            <label className="text-xs text-muted">{label}</label>
            {children}
        </div>
    );
}

const inputCls = "w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 [color-scheme:dark]";
