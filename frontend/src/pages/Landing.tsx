import { Navigate } from "react-router-dom";
import { GitHubIcon } from "../components/icons/GitHubIcon";
import { NotionIcon } from "../components/icons/NotionIcon";
import { Button } from "../components/ui/button";
import { useNotion } from "../hooks/useNotion";

function Landing() {
    const { auth, initStatus, initError, login, logout, retryInit } = useNotion();

    if (auth && initStatus !== "error") return <Navigate to="/" replace />;

    const actionBlock = (() => {
        if (!auth) {
            return (
                <Button
                    size="lg"
                    onClick={login}
                    className="mt-6 rounded-xl bg-green-500/20 backdrop-blur-md border border-green-500/30 px-8 h-14 font-semibold text-green-400 shadow-lg shadow-green-900/40 transition-all duration-200 hover:bg-green-500/30 hover:border-green-400/50 hover:shadow-green-500/20 hover:text-green-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                    <NotionIcon className="w-5 h-5 mr-2" />
                    Connect to Notion
                </Button>
            );
        }
        return (
            <div className="mt-6 flex flex-col items-center gap-4 bg-surface-card/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
                <div className="text-center">
                    <p className="text-red-400 text-sm font-semibold">Failed to set up workspace</p>
                    <p className="text-muted text-xs mt-1 max-w-[250px] break-words">{initError}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="default"
                        onClick={retryInit}
                    >
                        Retry Connection
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={logout}
                        className="text-muted hover:text-white"
                    >
                        Disconnect
                    </Button>
                </div>
            </div>
        );
    })();

    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-surface relative overflow-hidden">
            {/* Background image and elements for Glassmorphism */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30 pointer-events-none"
                style={{ backgroundImage: `url('/images/bull-bg.png')` }}
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
                        src="/icon.png"
                        alt="InTheGreenYet"
                        className="relative w-24 h-24 drop-shadow-lg"
                    />
                </div>

                {/* Title */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        InTheGreenYet
                    </h1>
                    <p className="mt-2 text-muted text-sm sm:text-base leading-relaxed">
                        It's not about today's profit —<br className="sm:hidden" />
                        it's about knowing where you truly stand.
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
                    <GitHubIcon className="w-3.5 h-3.5" />
                    hsin19/InTheGreenYet
                </a>
            </footer>
        </div>
    );
}

export default Landing;
