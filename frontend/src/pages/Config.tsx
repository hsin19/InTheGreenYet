import {
    Check,
    Edit2,
    Plus,
    RefreshCw,
    Save,
    Trash2,
    X,
} from "lucide-react";
import {
    useEffect,
    useState,
} from "react";
import {
    type AccountConfig,
    useAppData,
} from "../hooks/useAppData";
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

// ─── Accounts section ─────────────────────────────────────────

interface AccountsState {
    items: Record<string, AccountConfig>;
    keyInput: string;
    displayNameInput: string;
    saving: boolean;
    saved: boolean;
    error: string | null;
}

function AccountsSection({
    state,
    onChange,
    onSave,
}: {
    state: AccountsState;
    onChange: (s: AccountsState) => void;
    onSave: () => void;
}) {
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const addItem = () => {
        const key = state.keyInput.trim();
        const displayName = state.displayNameInput.trim() || key;
        if (!key || key in state.items) return;
        onChange({
            ...state,
            items: { ...state.items, [key]: { displayName } },
            keyInput: "",
            displayNameInput: "",
            saved: false,
            error: null,
        });
    };

    const removeItem = (key: string) => {
        const next = { ...state.items };
        delete next[key];
        onChange({ ...state, items: next, saved: false, error: null });
    };

    const startEdit = (key: string, currentName: string) => {
        setEditingKey(key);
        setEditName(currentName);
    };

    const cancelEdit = () => {
        setEditingKey(null);
        setEditName("");
    };

    const saveEdit = (key: string) => {
        const displayName = editName.trim() || key;
        onChange({
            ...state,
            items: { ...state.items, [key]: { displayName } },
            saved: false,
            error: null,
        });
        setEditingKey(null);
    };

    const entries = Object.entries(state.items);

    return (
        <div className="bg-surface-card border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-white font-semibold text-base">Accounts</h2>
                    <p className="text-muted text-xs mt-0.5">Available From / To accounts in transfers</p>
                </div>
                <SaveButton saving={state.saving} saved={state.saved} onSave={onSave} />
            </div>

            {/* Account list */}
            <div className="flex flex-col gap-2">
                {entries.length === 0 && <span className="text-muted/50 text-xs italic">No accounts yet</span>}
                {entries.map(([key, acc]) => (
                    editingKey === key ? (
                        <div key={key} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface border border-green-500/50">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-white text-sm font-medium shrink-0 max-w-[6rem] truncate" title={key}>{key}</span>
                                <div className="h-4 w-[1px] bg-white/10 shrink-0 mx-1" />
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") saveEdit(key);
                                        if (e.key === "Escape") cancelEdit();
                                    }}
                                    autoFocus
                                    className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder:text-muted/50 min-w-0"
                                    placeholder="Display name"
                                />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => saveEdit(key)} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors cursor-pointer" aria-label="Save edit">
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={cancelEdit} className="p-1.5 text-muted hover:bg-white/10 hover:text-white rounded transition-colors cursor-pointer" aria-label="Cancel edit">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div key={key} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface border border-white/10 group">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-white text-sm font-medium shrink-0">{key}</span>
                                {acc.displayName !== key && <span className="text-muted text-xs truncate">{acc.displayName}</span>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <button
                                    onClick={() => startEdit(key, acc.displayName)}
                                    className="p-1.5 text-muted hover:bg-blue-500/20 hover:text-blue-400 focus:bg-blue-500/20 focus:text-blue-400 rounded transition-colors cursor-pointer"
                                    aria-label={`Edit ${key}`}
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => removeItem(key)}
                                    className="p-1.5 text-muted hover:bg-red-500/20 hover:text-red-400 focus:bg-red-500/20 focus:text-red-400 rounded transition-colors cursor-pointer"
                                    aria-label={`Remove ${key}`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )
                ))}
            </div>

            {/* Add row */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={state.keyInput}
                    onChange={e => onChange({ ...state, keyInput: e.target.value, error: null })}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            addItem();
                        }
                    }}
                    placeholder="Key (e.g. binance)"
                    className="w-36 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-green-500/50 transition-colors"
                />
                <input
                    type="text"
                    value={state.displayNameInput}
                    onChange={e => onChange({ ...state, displayNameInput: e.target.value, error: null })}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            addItem();
                        }
                    }}
                    placeholder="Display name (optional)"
                    className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-green-500/50 transition-colors"
                />
                <AddButton onClick={addItem} disabled={!state.keyInput.trim()} />
            </div>
            <p className="text-muted/50 text-xs -mt-3">Key is the identifier stored in transfers. Display name is shown in the UI.</p>
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

    const [accounts, setAccounts] = useState<AccountsState>({
        items: {},
        keyInput: "",
        displayNameInput: "",
        saving: false,
        saved: false,
        error: null,
    });

    useEffect(() => {
        if (status !== "ready") return;
        setCurrencies(s => ({ ...s, items: config.currencies }));
        setAccounts(s => ({ ...s, items: config.accounts }));
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

    const saveAccounts = async () => {
        if (!auth) return;
        setAccounts(s => ({ ...s, saving: true, error: null, saved: false }));
        try {
            await updateConfig(auth.access_token, "accounts", accounts.items);
            setAccounts(s => ({ ...s, saving: false, saved: true }));
            refresh();
        } catch (err) {
            setAccounts(s => ({ ...s, saving: false, error: err instanceof Error ? err.message : "Failed to save" }));
        }
    };

    return (
        <div className="flex min-h-screen flex-col px-4 py-8 max-w-2xl mx-auto">
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
                    <AccountsSection
                        state={accounts}
                        onChange={setAccounts}
                        onSave={saveAccounts}
                    />
                </div>
            )}
        </div>
    );
}

export default Config;
