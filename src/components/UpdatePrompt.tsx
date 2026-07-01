import { formatBuildDate } from "@/lib/version";
import {
    Trans,
    useLingui,
} from "@lingui/react/macro";
import {
    RefreshCw,
    X,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "./ui/button";

export function UpdatePrompt() {
    const { t } = useLingui();
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW();

    if (!needRefresh) return null;

    const buildDate = formatBuildDate();

    return (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 sm:bottom-6">
            <div
                role="alert"
                className="flex items-center gap-2 rounded-full border border-white/[0.15] bg-[#161a22]/95 py-1.5 pr-1.5 pl-4 shadow-lg ring-1 ring-white/[0.05] backdrop-blur-xl"
            >
                <span className="text-xs font-medium whitespace-nowrap text-white">
                    <Trans>New version available ({buildDate})</Trans>
                </span>
                <Button size="sm" onClick={() => void updateServiceWorker(true)}>
                    <RefreshCw aria-hidden="true" />
                    <Trans>Update</Trans>
                </Button>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t`Update later`}
                    onClick={() => setNeedRefresh(false)}
                >
                    <X aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}
