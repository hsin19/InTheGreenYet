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

const API_MANAGEMENT_URL = "https://www.binance.com/en/my/settings/api-management";

const STEPS: { title: string; body: ReactNode; }[] = [
    {
        title: "Open API Management",
        body: (
            <>
                Sign in to Binance, then go to{" "}
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
            </>
        ),
    },
    {
        title: "Create an API key",
        body: (
            <>
                Click <span className="text-white">Create API</span>, choose <span className="text-white">System generated</span>, label it (e.g. &quot;InTheGreenYet&quot;), and finish the 2FA verification.
            </>
        ),
    },
    {
        title: "Leave the defaults as-is",
        body: (
            <>
                No need to change anything. A new key already has only <span className="text-white">Reading</span> enabled, which is all this app needs. Leave <span className="text-white">IP access restrictions</span> unrestricted too — this app runs on Cloudflare&apos;s rotating IPs, so a fixed allowlist would block it.
            </>
        ),
    },
    {
        title: "Copy the keys",
        body: (
            <>
                Copy the <span className="text-white">API Key</span> and <span className="text-white">Secret Key</span> (the secret is shown only once) and paste them into the fields above.
            </>
        ),
    },
];

export function BinanceKeyGuide() {
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
                    <DialogTitle className="text-xl font-semibold text-white">Get your Binance API key</DialogTitle>
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
