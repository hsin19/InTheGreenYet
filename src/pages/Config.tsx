import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAppData } from "@/hooks/useAppData";
import {
    APP_VERSION,
    formatBuildDate,
} from "@/lib/version";
import {
    Trans,
    useLingui,
} from "@lingui/react/macro";
import {
    AlertCircle,
    LogOut,
    Plus,
    RefreshCw,
    Save,
    Trash2,
} from "lucide-react";
import {
    useEffect,
    useState,
} from "react";
import { GitHubIcon } from "../components/icons/GitHubIcon";
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
} from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
    Command,
    CommandGroup,
    CommandItem,
    CommandList,
} from "../components/ui/command";
import { Input } from "../components/ui/input";
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from "../components/ui/popover";
import { useNotion } from "../hooks/useNotion";
import {
    getSelectedLocale,
    LOCALE_OPTIONS,
    type SelectedLocale,
    setSelectedLocale,
} from "../i18n";

// ─── Shared CurrencyInput ─────────────────────────────────────

function CurrencyInput({
    value,
    onChange,
    onConfirm,
    currencyOptions,
    placeholder,
    className,
    id,
    "aria-label": ariaLabel,
}: {
    "value": string;
    "onChange": (val: string) => void;
    "onConfirm"?: () => void;
    "currencyOptions": string[];
    "placeholder"?: string;
    "className"?: string;
    "id"?: string;
    "aria-label"?: string;
}) {
    const [open, setOpen] = useState(false);
    const filtered = value
        ? currencyOptions.filter(c => c.startsWith(value)).slice(0, 20)
        : [];

    return (
        <Popover open={open && filtered.length > 0} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <Input
                    id={id}
                    aria-label={ariaLabel}
                    type="text"
                    value={value}
                    onChange={e => {
                        onChange(e.target.value.toUpperCase());
                        setOpen(true);
                    }}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            onConfirm?.();
                            setOpen(false);
                        }
                        if (e.key === "Escape") setOpen(false);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className={className}
                />
            </PopoverAnchor>
            <PopoverContent
                className="p-0 w-(--radix-popover-anchor-width)"
                align="start"
                onOpenAutoFocus={e => e.preventDefault()}
            >
                <Command shouldFilter={false}>
                    <CommandList>
                        <CommandGroup>
                            {filtered.map(c => (
                                <CommandItem
                                    key={c}
                                    value={c}
                                    onSelect={() => {
                                        onChange(c);
                                        onConfirm?.();
                                        setOpen(false);
                                    }}
                                >
                                    {c}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// ─── Base Currency section ────────────────────────────────────

interface BaseCurrencyState {
    value: string;
    saving: boolean;
    saved: boolean;
    error: string | null;
}

function BaseCurrencySection({
    state,
    onChange,
    onSave,
    currencyOptions,
}: {
    state: BaseCurrencyState;
    onChange: (s: BaseCurrencyState) => void;
    onSave: () => void;
    currencyOptions: string[];
}) {
    const { t } = useLingui();

    return (
        <Card className="p-6 gap-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <label htmlFor="base-currency" className="text-white font-semibold text-base block cursor-pointer text-pretty">
                        <Trans>Base Currency</Trans>
                    </label>
                    <p className="text-muted text-xs mt-0.5">
                        <Trans>The primary currency total assets are calculated in</Trans>
                    </p>
                </div>
                <SaveButton saving={state.saving} saved={state.saved} onSave={onSave} />
            </div>

            <CurrencyInput
                id="base-currency"
                aria-label={t`Base Currency`}
                value={state.value}
                onChange={val => onChange({ ...state, value: val, error: null, saved: false })}
                onConfirm={onSave}
                currencyOptions={currencyOptions}
                placeholder={t`e.g. USD, EUR, JPY…`}
                className="max-w-[200px]"
            />
            {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
        </Card>
    );
}

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
    isSupported,
    currencyOptions,
}: {
    state: CurrenciesState;
    onChange: (s: CurrenciesState) => void;
    onSave: () => void;
    isSupported: (currency: string) => boolean;
    currencyOptions: string[];
}) {
    const { t } = useLingui();

    const addItem = (val?: string) => {
        const v = (val ?? state.input).trim().toUpperCase();
        if (!v || state.items.includes(v)) return;
        if (!isSupported(v)) {
            onChange({ ...state, error: t`${v} is not a supported currency` });
            return;
        }
        onChange({ ...state, items: [...state.items, v], input: "", saved: false, error: null });
    };

    const removeItem = (item: string) => {
        onChange({ ...state, items: state.items.filter(i => i !== item), saved: false, error: null });
    };

    return (
        <Card className="p-6 gap-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-white font-semibold text-base">
                        <Trans>Currencies</Trans>
                    </h2>
                    <p className="text-muted text-xs mt-0.5">
                        <Trans>Available currencies when creating transfers</Trans>
                    </p>
                </div>
                <SaveButton saving={state.saving} saved={state.saved} onSave={onSave} />
            </div>

            <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {state.items.length === 0 && (
                    <span className="text-muted/50 text-xs italic">
                        <Trans>No currencies yet</Trans>
                    </span>
                )}
                {state.items.map(item => (
                    <span key={item} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-white/10 text-sm text-white">
                        {item}
                        <button onClick={() => removeItem(item)} className="-m-1 p-1 rounded text-muted hover:text-red-400 transition-colors cursor-pointer" aria-label={t`Remove ${item}`}>
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <label htmlFor="add-currency" className="sr-only">Add currency</label>
                <CurrencyInput
                    id="add-currency"
                    aria-label={t`Add Currency`}
                    value={state.input}
                    onChange={val => onChange({ ...state, input: val, error: null })}
                    onConfirm={() => addItem()}
                    currencyOptions={currencyOptions}
                    placeholder={t`Add currency (e.g. EUR, JPY)…`}
                    className="flex-1"
                />
                <Button size="icon" onClick={() => addItem()} disabled={!state.input.trim()} aria-label={t`Add currency button`}>
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
            {saving ? <Trans>Saving…</Trans> : saved ? <Trans>Saved!</Trans> : <Trans>Save</Trans>}
        </Button>
    );
}

// ─── Page ─────────────────────────────────────────────────────

function Config() {
    const { config, status, refresh, exchangeRates, saveConfig } = useAppData();
    const { auth, logout } = useNotion();
    const { t } = useLingui();

    const [selectedLocale, setSelectedLocaleState] = useState(getSelectedLocale());

    const handleLanguageChange = (val: string) => {
        const locale = val as SelectedLocale;
        setSelectedLocaleState(locale);
        setSelectedLocale(locale);
    };

    const isSupported = (currency: string): boolean => {
        if (!currency) return false;
        if (!exchangeRates) return true; // 無法驗證時放行
        const baseLower = config.baseCurrency.toLowerCase();
        if (currency.toUpperCase() === config.baseCurrency.toUpperCase()) return true;
        const rateDict = exchangeRates[baseLower];
        if (typeof rateDict !== "object") return true;
        return currency.toLowerCase() in rateDict;
    };

    const [currencies, setCurrencies] = useState<CurrenciesState>({
        items: [],
        input: "",
        saving: false,
        saved: false,
        error: null,
    });

    const [baseCurrency, setBaseCurrency] = useState<BaseCurrencyState>({
        value: "",
        saving: false,
        saved: false,
        error: null,
    });

    useEffect(() => {
        if (status !== "ready") return;
        setCurrencies(s => ({ ...s, items: config.currencies }));
        setBaseCurrency(s => ({ ...s, value: config.baseCurrency }));
    }, [status, config]);

    const saveCurrencies = async () => {
        setCurrencies(s => ({ ...s, saving: true, error: null, saved: false }));
        try {
            await saveConfig("currencies", currencies.items);
            setCurrencies(s => ({ ...s, saving: false, saved: true }));
        } catch (err) {
            setCurrencies(s => ({ ...s, saving: false, error: err instanceof Error ? err.message : t`Failed to save` }));
        }
    };

    const saveBaseCurrency = async () => {
        const val = baseCurrency.value.trim().toUpperCase();
        if (!val) {
            setBaseCurrency(s => ({ ...s, error: t`Base currency cannot be empty` }));
            return;
        }
        if (!isSupported(val)) {
            setBaseCurrency(s => ({ ...s, error: t`${val} is not a supported currency` }));
            return;
        }
        setBaseCurrency(s => ({ ...s, saving: true, error: null, saved: false }));
        try {
            await saveConfig("baseCurrency", val);
            setBaseCurrency(s => ({ ...s, saving: false, saved: true, value: val }));
        } catch (err) {
            setBaseCurrency(s => ({ ...s, saving: false, error: err instanceof Error ? err.message : t`Failed to save` }));
        }
    };

    return (
        <div className="flex min-h-full flex-col px-4 py-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white text-pretty">
                    <Trans>Settings</Trans>
                </h1>
            </div>

            {status === "loading" && (
                <div className="flex flex-col items-center gap-3 py-16">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                    <p className="text-muted text-sm">
                        <Trans>Loading config…</Trans>
                    </p>
                </div>
            )}

            {status === "error" && (
                <Card className="items-center text-center p-8 gap-3 border-red-500/20 shadow-red-500/5">
                    <AlertCircle className="size-7 text-rose-400" aria-hidden="true" />
                    <p className="text-red-400 text-sm font-medium">
                        <Trans>Failed to load config</Trans>
                    </p>
                    <Button variant="secondary" onClick={refresh} className="mt-2">
                        <Trans>Retry</Trans>
                    </Button>
                </Card>
            )}

            {status === "ready" && (
                <div className="flex flex-col gap-4">
                    <BaseCurrencySection
                        state={baseCurrency}
                        onChange={setBaseCurrency}
                        onSave={saveBaseCurrency}
                        currencyOptions={exchangeRates ? Object.keys(exchangeRates[config.baseCurrency.toLowerCase()] ?? {}).map(c => c.toUpperCase()) : []}
                    />
                    <CurrenciesSection
                        state={currencies}
                        onChange={setCurrencies}
                        onSave={saveCurrencies}
                        isSupported={isSupported}
                        currencyOptions={exchangeRates ? Object.keys(exchangeRates[config.baseCurrency.toLowerCase()] ?? {}).map(c => c.toUpperCase()) : []}
                    />
                </div>
            )}

            <div className="pt-4 flex flex-col gap-4">
                <Card className="p-6 gap-4 border-white/[0.06]">
                    <div>
                        <h2 className="text-white font-semibold text-base">
                            <Trans>Language</Trans>
                        </h2>
                        <p className="text-muted text-xs mt-0.5">
                            <Trans>Select the display language for the application.</Trans>
                        </p>
                    </div>
                    <div className="w-full max-w-xs">
                        <Select
                            value={selectedLocale}
                            onValueChange={handleLanguageChange}
                        >
                            <SelectTrigger className="bg-white/8 border-white/15 text-white w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                {LOCALE_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {typeof opt.label === "string" ? opt.label : t(opt.label)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </Card>

                <Card className="p-6 gap-4 border-white/[0.06]">
                    <div>
                        <h2 className="text-white font-semibold text-base">
                            <Trans>Notion Workspace</Trans>
                        </h2>
                        <p className="text-muted text-xs mt-0.5">{auth?.workspace_name}</p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-fit text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/50">
                                <LogOut className="w-4 h-4 mr-2" />
                                <Trans>Log out</Trans>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90vw] max-w-sm">
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    <Trans>Log out of Notion?</Trans>
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    <Trans>This will disconnect your workspace and log you out of the application.</Trans>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>
                                    <Trans>Cancel</Trans>
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={logout}
                                    className="bg-rose-500 text-white hover:bg-rose-600 border-none shadow-lg shadow-rose-500/20"
                                >
                                    <Trans>Log out</Trans>
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </Card>

                <Card className="p-6 gap-3 border-white/[0.06]">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-white font-semibold text-base">InTheGreenYet</h2>
                            <p className="text-muted text-xs mt-1 leading-relaxed">
                                <Trans>It’s not about today’s profit — it’s about knowing where you truly stand.</Trans>
                            </p>
                        </div>
                        <a
                            href="https://github.com/hsin19/InTheGreenYet"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted/40 hover:text-muted transition-colors mt-0.5"
                            aria-label={t`GitHub repository`}
                        >
                            <GitHubIcon className="w-4 h-4" />
                        </a>
                    </div>
                    <p className="text-muted/40 text-xs">
                        <Trans>Your data stays in your Notion workspace and is never stored or transmitted externally.</Trans>
                    </p>
                    <p className="text-muted/40 text-xs">
                        <Trans>Version</Trans>: {APP_VERSION} · {formatBuildDate()}
                    </p>
                </Card>
            </div>
        </div>
    );
}

export default Config;
