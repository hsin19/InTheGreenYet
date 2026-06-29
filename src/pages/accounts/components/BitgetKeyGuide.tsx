import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import {
    Trans,
    useLingui,
} from "@lingui/react/macro";
import {
    ExternalLink,
    ShieldCheck,
} from "lucide-react";
import {
    type ReactNode,
    useState,
} from "react";
import { CopyableValue } from "./CopyableValue";

const API_MANAGEMENT_URL = "https://www.bitget.com/account/newapi";

/** Suggest a passphrase so the user doesn't have to invent one. Letters+digits, no ambiguous chars. */
function generatePassphrase(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

/** A freshly suggested passphrase (regenerated each time the guide opens). */
function PassphraseField() {
    const [passphrase] = useState(generatePassphrase);
    return <CopyableValue value={passphrase} />;
}

const STEPS: { title: MessageDescriptor; body: ReactNode; }[] = [
    {
        title: msg`Open API Management`,
        body: (
            <Trans>
                Sign in to Bitget, then go to{" "}
                <a
                    href={API_MANAGEMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-300 underline underline-offset-2 hover:text-amber-200 inline-flex items-center gap-0.5"
                >
                    Account → API Management
                    <ExternalLink className="w-3 h-3" />
                </a>
                .
            </Trans>
        ),
    },
    {
        title: msg`Create an API key`,
        body: (
            <Trans>
                Click <span className="text-white">Create API</span>, choose <span className="text-white">System-generated API key</span>, then fill in the fields — feel free to use these suggestions:
                <ul className="mt-1.5 flex flex-col gap-1.5">
                    <li className="flex items-center gap-2">
                        <span className="w-24 shrink-0">Note</span>
                        <CopyableValue value="InTheGreenYet" />
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-24 shrink-0">Passphrase</span>
                        <PassphraseField />
                    </li>
                </ul>
                <span className="mt-1.5 block">Keep the passphrase — the app needs it alongside the key and secret.</span>
            </Trans>
        ),
    },
    {
        title: msg`Set read-only permissions`,
        body: (
            <Trans>
                For <span className="text-white">Permissions</span> choose <span className="text-white">Read-only</span>, then tick <span className="text-white">Select all</span> — in read-only mode every box is read-only (&quot;Search for…&quot;), so the key still can&apos;t trade or withdraw. Leave <span className="text-white">IP access</span> unrestricted — this app runs on Cloudflare&apos;s rotating IPs, so a fixed allowlist would block it.
            </Trans>
        ),
    },
    {
        title: msg`Copy the credentials`,
        body: (
            <Trans>
                Copy the <span className="text-white">API Key</span>, <span className="text-white">Secret Key</span> (shown only once) and the <span className="text-white">passphrase</span> you set, then paste all three into the fields above.
            </Trans>
        ),
    },
];

export function BitgetKeyGuide() {
    const { t } = useLingui();

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="text-xs text-amber-300/90 underline underline-offset-2 hover:text-amber-200 self-start cursor-pointer"
                >
                    <Trans>How do I get these?</Trans>
                </button>
            </DialogTrigger>
            <DialogContent className="bg-surface/80 backdrop-blur-3xl border border-white/20 text-white sm:max-w-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-6 gap-5 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-white">
                        <Trans>Get your Bitget API key</Trans>
                    </DialogTitle>
                    <DialogDescription className="text-muted">
                        <Trans>Create a read-only key — InTheGreenYet only reads your balances, it never trades or withdraws.</Trans>
                    </DialogDescription>
                </DialogHeader>

                <ol className="flex flex-col gap-4">
                    {STEPS.map((step, i) => (
                        <li key={i} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 border border-white/15 text-xs font-semibold flex items-center justify-center text-white">
                                {i + 1}
                            </span>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-sm font-medium text-white">{t(step.title)}</p>
                                <div className="text-xs text-muted leading-relaxed">{step.body}</div>
                            </div>
                        </li>
                    ))}
                </ol>

                <div className="flex gap-2 items-start rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
                    <ShieldCheck className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-100/90 leading-relaxed">
                        <Trans>Your keys are stored in your own Notion workspace. Using a read-only key means they can never move your funds, even if exposed.</Trans>
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
