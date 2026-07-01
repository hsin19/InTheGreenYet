import {
    Check,
    Copy,
} from "lucide-react";
import { useState } from "react";

/** A monospace value with a one-click copy button, so the user can paste it verbatim.
 *  Pass `label` to show friendly text in place of a value too long to display (e.g. a URL). */
export function CopyableValue({ value, label }: { value: string; label?: string; }) {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <span className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/8 px-2 py-0.5 font-mono text-white align-middle">
            {label ?? value}
            <button
                type="button"
                onClick={copy}
                className="text-muted hover:text-white transition-colors cursor-pointer"
                aria-label={`Copy ${label ?? value}`}
            >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        </span>
    );
}
