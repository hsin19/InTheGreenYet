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
    Trans,
    useLingui,
} from "@lingui/react/macro";
import { useState } from "react";
import { getApiProvider } from "./apiProviders";

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
    const { t } = useLingui();

    // Parent passes a fresh `key` prop on each open so this component remounts
    // and lazy useState initializers re-run with the current props.
    const [key, setKey] = useState(() => isCreate ? "" : editingKey);
    const [displayName, setDisplayName] = useState(() => isCreate ? "" : existingConfig?.displayName ?? "");
    const [currency, setCurrency] = useState(() => isCreate ? "" : existingConfig?.currency ?? "");
    const [accountType, setAccountType] = useState(() => isCreate ? "bank" : existingConfig?.accountType ?? "bank");
    const [isInvestment, setIsInvestment] = useState(() => isCreate ? true : existingConfig?.isInvestment ?? true);
    const [credentials, setCredentials] = useState<Record<string, string>>(() => {
        if (isCreate) return {};
        return {
            apiKey: existingConfig?.apiKey ?? "",
            apiSecret: existingConfig?.apiSecret ?? "",
            apiPassphrase: existingConfig?.apiPassphrase ?? "",
            apiMode: existingConfig?.apiMode ?? "",
        } as Record<string, string>;
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const provider = getApiProvider(accountType);

    const handleSave = async () => {
        const trimmedKey = isCreate ? key.trim() : editingKey!;
        const trimmedName = displayName.trim() || trimmedKey;

        if (isCreate && !trimmedKey) {
            setError(t`Key is required`);
            return;
        }
        if (isCreate && existingKeys.includes(trimmedKey)) {
            setError(t`Key "${trimmedKey}" already exists`);
            return;
        }

        if (!currency) {
            setError(t`Currency is required`);
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const next: AccountConfig = {
                ...(existingConfig ?? {}),
                displayName: trimmedName,
                currency: currency,
                accountType: accountType,
                isInvestment: isInvestment,
            };
            // Provider fields (all `api*`) only belong to API-backed accounts; drop them otherwise.
            const bag = next as unknown as Record<string, unknown>;
            for (const k of Object.keys(bag)) {
                if (k.startsWith("api")) delete bag[k];
            }
            if (provider) {
                for (const field of provider.fields) {
                    const raw = (credentials[field.name] ?? "").trim();
                    const value = raw || (field.kind === "select" ? field.default : "");
                    if (value) next[field.name] = value;
                }
            }
            await onSave(trimmedKey, next);
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : t`Failed to save`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="bg-surface/80 backdrop-blur-3xl border border-white/20 text-white sm:max-w-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-6 gap-6 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-white">
                        {isCreate ? <Trans>New Account</Trans> : <Trans>Edit "{editingKey}"</Trans>}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-2">
                    {isCreate && (
                        <div className="flex flex-col gap-1">
                            <label htmlFor="account-key" className="text-xs text-muted">
                                <Trans>Key</Trans> <span className="text-red-400">*</span>
                            </label>
                            <Input
                                id="account-key"
                                value={key}
                                onChange={e => setKey(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleSave()}
                                placeholder={t`e.g. binance`}
                                className="bg-white/8 border-white/15 text-white placeholder:text-muted/50"
                                autoFocus
                            />
                            <p className="text-muted/50 text-xs">
                                <Trans>Identifier used in transfers. Cannot be changed later.</Trans>
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <label htmlFor="account-display-name" className="text-xs text-muted">
                            <Trans>Display Name</Trans>
                        </label>
                        <Input
                            id="account-display-name"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSave()}
                            placeholder={isCreate ? key || t`Display name` : editingKey ?? ""}
                            className="bg-white/8 border-white/15 text-white placeholder:text-muted/50"
                            autoFocus={!isCreate}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="account-currency" className="text-xs text-muted">
                            <Trans>Currency</Trans> <span className="text-red-400">*</span>
                        </label>
                        <Select
                            value={currency}
                            onValueChange={val => setCurrency(val)}
                        >
                            <SelectTrigger id="account-currency" className="bg-white/8 border-white/15 text-white">
                                <SelectValue placeholder={t`Select currency`} />
                            </SelectTrigger>
                            <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                {availableCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {availableCurrencies.length === 0 && (
                            <p className="text-amber-300/80 text-xs">
                                <Trans>No currencies yet — add one under Settings before creating an account.</Trans>
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="account-type" className="text-xs text-muted">
                            <Trans>Account Type</Trans> <span className="text-red-400">*</span>
                        </label>
                        <Select
                            value={accountType}
                            onValueChange={val => setAccountType(val)}
                        >
                            <SelectTrigger id="account-type" className="bg-white/8 border-white/15 text-white">
                                <SelectValue placeholder={t`Select type`} />
                            </SelectTrigger>
                            <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                <SelectItem value="bank">
                                    <Trans>Bank</Trans>
                                </SelectItem>
                                <SelectItem value="binance">Binance</SelectItem>
                                <SelectItem value="okx">OKX</SelectItem>
                                <SelectItem value="max">MAX</SelectItem>
                                <SelectItem value="bitget">Bitget</SelectItem>
                                <SelectItem value="other">
                                    <Trans>Other</Trans>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {provider && (
                        <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                            <p className="text-xs font-medium text-white">
                                <Trans>Connect to {provider.label}</Trans>
                            </p>
                            {provider.note && (
                                <p className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-200/90 leading-relaxed">
                                    {t(provider.note)}
                                </p>
                            )}
                            {provider.fields.map(field => (
                                <div key={field.name} className="flex flex-col gap-1">
                                    <label htmlFor={`credential-${field.name}`} className="text-xs text-muted">
                                        {t(field.label)}
                                    </label>
                                    {field.kind === "select"
                                        ? (
                                            <Select
                                                value={credentials[field.name] || field.default}
                                                onValueChange={v => setCredentials(c => ({ ...c, [field.name]: v }))}
                                            >
                                                <SelectTrigger id={`credential-${field.name}`} className="bg-white/8 border-white/15 text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-surface-card border-white/5 text-white backdrop-blur-xl">
                                                    {field.options.map(o => (
                                                        <SelectItem key={o.value} value={o.value}>
                                                            {t(o.label)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )
                                        : (
                                            <Input
                                                id={`credential-${field.name}`}
                                                value={credentials[field.name] ?? ""}
                                                onChange={e => setCredentials(c => ({ ...c, [field.name]: e.target.value }))}
                                                type="password"
                                                autoComplete="off"
                                                placeholder={t(field.label)}
                                                className="bg-white/8 border-white/15 text-white placeholder:text-muted/50"
                                            />
                                        )}
                                </div>
                            ))}
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-muted/50 text-xs">
                                    {provider.keyHint ? t(provider.keyHint) : t`Use a read-only key.`}
                                </p>
                                <provider.guide />
                            </div>
                        </div>
                    )}

                    <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                        <span className="relative flex-shrink-0 w-4 h-4">
                            <input
                                type="checkbox"
                                id="isInvestment"
                                checked={isInvestment}
                                onChange={e => setIsInvestment(e.target.checked)}
                                className="w-4 h-4 rounded appearance-none border border-white/15 bg-white/8 checked:bg-green-500 checked:border-green-500 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:outline-none"
                            />
                            {isInvestment && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-black font-bold">✓</span>}
                        </span>
                        <span className="text-xs text-muted">
                            <Trans>Include in portfolio totals?</Trans>
                        </span>
                    </label>

                    {error && <p className="text-red-400 text-xs">{error}</p>}
                </div>

                <DialogFooter className="pt-2">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
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
