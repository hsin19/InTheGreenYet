import { type AccountConfig } from "@/hooks/useAppData";
import {
    Trans,
    useLingui,
} from "@lingui/react/macro";
import { Pencil } from "lucide-react";
import {
    useRef,
    useState,
} from "react";

interface InlineAmountProps {
    accountKey: string;
    config: AccountConfig;
    onSave: (key: string, config: AccountConfig) => Promise<void>;
    large?: boolean;
}

export function InlineAmount({
    accountKey,
    config,
    onSave,
    large = false,
}: InlineAmountProps) {
    const { t } = useLingui();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState("");
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const startEdit = () => {
        setValue(config.amount != null ? String(config.amount) : "");
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const commit = async () => {
        const num = value.trim() === "" ? null : parseFloat(value.trim());
        if (num !== null && isNaN(num)) {
            setEditing(false);
            return;
        }
        setEditing(false);
        if (num === config.amount) return;
        setSaving(true);
        try {
            await onSave(accountKey, {
                ...config,
                amount: num,
                amountUpdatedAt: num !== null ? new Date().toISOString() : config.amountUpdatedAt,
            });
        } finally {
            setSaving(false);
        }
    };

    const currency = config.currency;

    if (editing) {
        return (
            <div className="flex items-center gap-1">
                {currency && <span className="text-muted text-xs">{currency}</span>}
                <input
                    ref={inputRef}
                    type="number"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={e => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") setEditing(false);
                    }}
                    className="w-28 bg-surface border border-green-500/50 rounded px-2 py-0.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:outline-none"
                    autoFocus
                    aria-label={t`Account balance`}
                />
            </div>
        );
    }

    return (
        <button
            onClick={startEdit}
            disabled={saving}
            className="flex items-center gap-1.5 group/amount cursor-pointer text-left"
            title={t`Click to edit balance`}
        >
            {config.amount != null ? (
                <>
                    <span className={`text-muted ${large ? "text-sm" : "text-xs"}`}>{currency}</span>
                    <span className={`text-white tabular-nums ${large ? "font-semibold text-2xl" : "font-medium text-sm"}`}>
                        {config.amount.toLocaleString()}
                    </span>
                    <Pencil className="w-3 h-3 text-muted hidden group-hover/amount:inline-block" aria-hidden="true" />
                </>
            ) : (
                <span className="text-muted/40 text-xs italic group-hover/amount:text-muted transition-colors">
                    {saving ? <Trans>Saving…</Trans> : <Trans>Set balance</Trans>}
                </span>
            )}
        </button>
    );
}
