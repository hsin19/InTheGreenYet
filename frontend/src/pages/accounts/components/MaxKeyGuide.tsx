import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    ExternalLink,
    ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { CopyableValue } from "./CopyableValue";

const API_TOKENS_URL = "https://max.maicoin.com/api_tokens";

const STEPS: { title: string; body: ReactNode; }[] = [
    {
        title: "Open API Tokens",
        body: (
            <>
                Sign in to MAX, then go to{" "}
                <a
                    href={API_TOKENS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-300 underline underline-offset-2 hover:text-amber-200 inline-flex items-center gap-0.5"
                >
                    Security Settings → API Tokens
                    <ExternalLink className="w-3 h-3" />
                </a>{" "}
                and click <span className="text-white">Add New API Token</span>.
            </>
        ),
    },
    {
        title: "Name the token",
        body: (
            <>
                The <span className="text-white">Label</span> is optional — feel free to use this: <CopyableValue value="InTheGreenYet" />.
            </>
        ),
    },
    {
        title: "Leave the IP Whitelist blank",
        body: (
            <>
                Leave <span className="text-white">IP Whitelist</span> empty — blank means all IPs are allowed, which this app needs since it runs on Cloudflare&apos;s rotating IPs.
            </>
        ),
    },
    {
        title: "Tick only the Read scopes",
        body: (
            <>
                Under <span className="text-white">Scope Settings</span>, check the <span className="text-white">Read</span> boxes (the balance comes from <span className="text-white">Account &amp; Personal Information</span>) and leave every <span className="text-white">Write</span> box unchecked — this app never trades or withdraws.
            </>
        ),
    },
    {
        title: "Copy the keys",
        body: (
            <>
                Finish the 2FA verification, then copy the <span className="text-white">Access Key</span> and <span className="text-white">Secret Key</span> (the secret is shown only once) and paste them into the fields above.
            </>
        ),
    },
];

export function MaxKeyGuide() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="text-xs text-amber-300/90 underline underline-offset-2 hover:text-amber-200 self-start cursor-pointer"
                >
                    How do I get these?
                </button>
            </DialogTrigger>
            <DialogContent className="bg-surface/80 backdrop-blur-3xl border border-white/20 text-white sm:max-w-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-6 gap-5 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-white">Get your MAX API key</DialogTitle>
                    <DialogDescription className="text-muted">
                        Create a read-only key — InTheGreenYet only reads your balances, it never trades or withdraws.
                    </DialogDescription>
                </DialogHeader>

                <ol className="flex flex-col gap-4">
                    {STEPS.map((step, i) => (
                        <li key={step.title} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 border border-white/15 text-xs font-semibold flex items-center justify-center text-white">
                                {i + 1}
                            </span>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-sm font-medium text-white">{step.title}</p>
                                <p className="text-xs text-muted leading-relaxed">{step.body}</p>
                            </div>
                        </li>
                    ))}
                </ol>

                <div className="flex gap-2 items-start rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
                    <ShieldCheck className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-100/90 leading-relaxed">
                        Your keys are stored in your own Notion workspace. Using a read-only key means they can never move your funds, even if exposed.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
