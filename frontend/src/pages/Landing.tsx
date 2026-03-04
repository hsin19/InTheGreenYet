import { Navigate } from "react-router-dom";
import { GitHubIcon } from "../components/icons/GitHubIcon";
import { NotionIcon } from "../components/icons/NotionIcon";
import { useNotion } from "../hooks/useNotion";

function Landing() {
    const { auth, login } = useNotion();

    if (auth) return <Navigate to="/transfers" replace />;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
            {/* Hero */}
            <div className="flex flex-col items-center gap-6 max-w-md text-center">
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

                <button
                    onClick={login}
                    className="mt-4 group relative inline-flex items-center gap-2.5 rounded-xl bg-green-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-green-400 hover:shadow-green-400/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                    <NotionIcon className="w-5 h-5" />
                    Connect to Notion
                </button>
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
