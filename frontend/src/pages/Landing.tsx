import bgMainDark from "@/assets/images/bg-main-dark.png?format=webp&quality=80&imagetools";
import {
    Navigate,
    useSearchParams,
} from "react-router-dom";
import { GitHubIcon } from "../components/icons/GitHubIcon";
import { NotionIcon } from "../components/icons/NotionIcon";
import { Button } from "../components/ui/button";
import { useNotion } from "../hooks/useNotion";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    state_mismatch: "Authorization request mismatch — please try again.",
    missing_token: "Authorization did not return a token.",
    token_exchange_failed: "Failed to complete authorization with Notion.",
    access_denied: "Authorization was denied.",
};

function Landing() {
    const { auth, login } = useNotion();
    const [searchParams] = useSearchParams();
    const oauthError = searchParams.get("error");

    if (auth) return <Navigate to="/" replace />;

    const actionBlock = (
        <div className="mt-6 flex flex-col items-center gap-4">
            {oauthError && (
                <p className="text-red-400 text-sm font-medium max-w-[280px] text-center">
                    {OAUTH_ERROR_MESSAGES[oauthError] ?? "Authorization failed."}
                </p>
            )}
            <div className="relative group">
                <div className="relative p-[2px] rounded-xl overflow-hidden group-hover:scale-[1.03] active:scale-[0.97] transition-all duration-300">
                    <div className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_25%,rgba(255,255,255,0.8)_95%,rgba(255,255,255,1)_100%)] opacity-100" />
                    <div className="relative rounded-[10px] bg-green-700">
                        <Button
                            size="lg"
                            onClick={login}
                            className="relative w-full rounded-[10px] bg-transparent px-8 h-14 font-semibold text-white hover:bg-white/10 hover:text-white transition-all duration-300 border-none m-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] ring-0 focus:ring-0"
                        >
                            <NotionIcon className="w-5 h-5 mr-2" aria-hidden="true" />
                            Connect to Notion
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-surface relative overflow-hidden">
            {/* Background image and elements for Glassmorphism */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-70 pointer-events-none"
                style={{ backgroundImage: `url(${bgMainDark})` }}
            />
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-900/20 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-[120px]" />
            </div>

            {/* Hero */}
            <div className="relative z-10 flex flex-col items-center gap-6 max-w-md text-center">
                {/* Icon with glow */}
                <div className="relative">
                    <div className="absolute inset-0 blur-3xl opacity-20 bg-green-500 rounded-full scale-150" />
                    <img
                        src="/icon.svg"
                        alt="InTheGreenYet"
                        width={96}
                        height={96}
                        className="relative w-24 h-24 drop-shadow-lg"
                    />
                </div>

                {/* Title */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl text-pretty">
                        InTheGreenYet
                    </h1>
                    <p className="mt-2 text-muted text-sm sm:text-base leading-relaxed">
                        It’s not about today’s profit —<br className="sm:hidden" />
                        it’s about knowing where you truly stand.
                    </p>
                </div>

                {actionBlock}
            </div>

            {/* Footer */}
            <footer className="absolute bottom-6 flex flex-col items-center gap-2 text-xs text-muted/50">
                <p>Your data stays in your Notion workspace.</p>
                <a
                    href="https://github.com/hsin19/InTheGreenYet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted/40 hover:text-muted transition-colors"
                >
                    <GitHubIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    hsin19/InTheGreenYet
                </a>
            </footer>
        </div>
    );
}

export default Landing;
