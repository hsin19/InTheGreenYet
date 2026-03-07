import { Pencil } from "lucide-react";
import {
    useRef,
    useState,
} from "react";
import { type AccountConfig } from "../../../hooks/useAppData";

interface InlineAmountProps {
    accountKey: string;
    config: AccountConfig;
    onSave: (key: string, config: AccountConfig) => Promise<void>;
}

export function InlineAmount({
    accountKey,
    config,
    onSave,
}: InlineAmountProps) {
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
                    className="w-28 bg-surface border border-green-500/50 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                    autoFocus
                />
            </div>
        );
    }

    return (
        <button
            onClick={startEdit}
            disabled={saving}
            className="flex items-center gap-1.5 group/amount cursor-pointer text-left"
            title="Click to edit balance"
        >
            {config.amount != null ? (
                <>
                    <span className="text-muted text-xs">{currency}</span>
                    <span className="text-white font-medium text-sm tabular-nums">
                        {config.amount.toLocaleString()}
                    </span>
                    <Pencil className="w-3 h-3 text-muted/0 group-hover/amount:text-muted transition-colors" />
                </>
            ) : (
                <span className="text-muted/40 text-xs italic group-hover/amount:text-muted transition-colors">
                    {saving ? "Saving..." : "Set balance"}
                </span>
            )}
        </button>
    );
}
