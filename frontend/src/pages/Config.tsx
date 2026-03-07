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
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
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
        <Card className="p-6 gap-5">
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
                <Input
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
                    className="flex-1"
                />
                <Button size="icon" onClick={addItem} disabled={!state.input.trim()}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
            {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
        </Card>
    );
}

// ─── Shared UI ────────────────────────────────────────────────

function SaveButton({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void; }) {
    return (
        <Button
            variant={saved ? "default" : "outline"}
            size="sm"
            onClick={onSave}
            disabled={saving}
        >
            {saving ? <RefreshCw className="w-3 h-3 animate-spin mr-1.5" /> : <Save className="w-3 h-3 mr-1.5" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
        </Button>
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
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-muted text-sm mt-1">Manage currencies and accounts used across the app</p>
            </div>

            {status === "loading" && (
                <div className="flex flex-col items-center gap-3 py-16">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                    <p className="text-muted text-sm">Loading config...</p>
                </div>
            )}

            {status === "error" && (
                <Card className="items-center text-center p-8 gap-3 border-red-500/20 shadow-red-500/5">
                    <span className="text-2xl">❌</span>
                    <p className="text-red-400 text-sm font-medium">Failed to load config</p>
                    <Button variant="secondary" onClick={refresh} className="mt-2">
                        Retry
                    </Button>
                </Card>
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
