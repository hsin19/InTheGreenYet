import {
    Plus,
    RefreshCw,
    Save,
    Trash2,
} from "lucide-react";
import {
    useEffect,
    useState,
} from "react";
import { useAppData } from "../hooks/useAppData";
import { useNotion } from "../hooks/useNotion";
import { updateConfig } from "../lib/notion";

// ─── Currencies section ───────────────────────────────────────

interface CurrenciesState {
    items: string[];
    input: string;
    saving: boolean;
    saved: boolean;
    error: string | null;
}

function CurrenciesSection({
    state,
    onChange,
    onSave,
}: {
    state: CurrenciesState;
    onChange: (s: CurrenciesState) => void;
    onSave: () => void;
}) {
    const addItem = () => {
        const val = state.input.trim().toUpperCase();
        if (!val || state.items.includes(val)) return;
        onChange({ ...state, items: [...state.items, val], input: "", saved: false, error: null });
    };

    const removeItem = (item: string) => {
        onChange({ ...state, items: state.items.filter(i => i !== item), saved: false, error: null });
    };

    return (
        <div className="bg-surface-card border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-white font-semibold text-base">Currencies</h2>
                    <p className="text-muted text-xs mt-0.5">Available currencies when creating transfers</p>
                </div>
                <SaveButton saving={state.saving} saved={state.saved} onSave={onSave} />
            </div>

            <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {state.items.length === 0 && <span className="text-muted/50 text-xs italic">No currencies yet</span>}
                {state.items.map(item => (
                    <span key={item} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-white/10 text-sm text-white">
                        {item}
                        <button onClick={() => removeItem(item)} className="text-muted hover:text-red-400 transition-colors cursor-pointer" aria-label={`Remove ${item}`}>
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={state.input}
                    onChange={e => onChange({ ...state, input: e.target.value, error: null })}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            addItem();
                        }
                    }}
                    placeholder="Add currency (e.g. ETH)..."
                    className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-green-500/50 transition-colors"
                />
                <AddButton onClick={addItem} disabled={!state.input.trim()} />
            </div>
            {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
        </div>
    );
}

// ─── Shared UI ────────────────────────────────────────────────

function SaveButton({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void; }) {
    return (
        <button
            onClick={onSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default shrink-0
                ${
                saved
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : "bg-surface border border-white/10 text-muted hover:text-white hover:bg-surface-hover"
            }`}
        >
            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
        </button>
    );
}

function AddButton({ onClick, disabled }: { onClick: () => void; disabled: boolean; }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="p-2 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            aria-label="Add item"
        >
            <Plus className="w-4 h-4" />
        </button>
    );
}

// ─── Page ─────────────────────────────────────────────────────

function Config() {
    const { config, status, refresh } = useAppData();
    const { auth } = useNotion();

    const [currencies, setCurrencies] = useState<CurrenciesState>({
        items: [],
        input: "",
        saving: false,
        saved: false,
        error: null,
    });

    useEffect(() => {
        if (status !== "ready") return;
        setCurrencies(s => ({ ...s, items: config.currencies }));
    }, [status, config]);

    const saveCurrencies = async () => {
        if (!auth) return;
        setCurrencies(s => ({ ...s, saving: true, error: null, saved: false }));
        try {
            await updateConfig(auth.access_token, "currencies", currencies.items);
            setCurrencies(s => ({ ...s, saving: false, saved: true }));
            refresh();
        } catch (err) {
            setCurrencies(s => ({ ...s, saving: false, error: err instanceof Error ? err.message : "Failed to save" }));
        }
    };

    return (
        <div className="flex min-h-screen flex-col px-4 py-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Config</h1>
                <p className="text-muted text-sm mt-1">Manage currencies and accounts used across the app</p>
            </div>

            {status === "loading" && (
                <div className="flex flex-col items-center gap-3 py-16">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                    <p className="text-muted text-sm">Loading config...</p>
                </div>
            )}

            {status === "error" && (
                <div className="bg-surface-card border border-red-500/20 rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
                    <span className="text-2xl">❌</span>
                    <p className="text-red-400 text-sm font-medium">Failed to load config</p>
                    <button
                        onClick={refresh}
                        className="px-4 py-2 bg-surface border border-white/10 rounded-lg text-sm text-white hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {status === "ready" && (
                <div className="flex flex-col gap-4">
                    <CurrenciesSection
                        state={currencies}
                        onChange={setCurrencies}
                        onSave={saveCurrencies}
                    />
                </div>
            )}
        </div>
    );
}

export default Config;
