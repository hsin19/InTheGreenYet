import { AppDataProvider } from "@/hooks/useAppData";
import {
    ArrowLeftRight,
    Settings,
    Wallet,
} from "lucide-react";
import {
    Navigate,
    NavLink,
    Outlet,
} from "react-router-dom";
import { useNotion } from "../hooks/useNotion";

function AppNav() {
    return (
        <header className="fixed bottom-6 sm:bottom-auto sm:top-6 inset-x-0 flex justify-center z-50 pointer-events-none px-4">
            <div className="pointer-events-auto flex items-center justify-between px-2 py-1.5 rounded-full border border-white/[0.15] bg-white/[0.07] backdrop-blur-xl shadow-2xl shadow-black/40 ring-1 ring-white/[0.05] w-fit gap-8 sm:gap-12 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
                <nav className="flex items-center gap-1 px-1">
                    <NavLink
                        to="/transfers"
                        className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${isActive ? "bg-white/[0.12] text-white ring-1 ring-white/[0.08]" : "text-muted hover:text-white hover:bg-white/[0.07]"}`}
                        aria-label="Transfers"
                    >
                        <ArrowLeftRight className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Transfers</span>
                    </NavLink>
                    <NavLink
                        to="/accounts"
                        className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${isActive ? "bg-white/[0.12] text-white ring-1 ring-white/[0.08]" : "text-muted hover:text-white hover:bg-white/[0.07]"}`}
                        aria-label="Accounts"
                    >
                        <Wallet className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Accounts</span>
                    </NavLink>
                    <NavLink
                        to="/config"
                        className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${isActive ? "bg-white/[0.12] text-white ring-1 ring-white/[0.08]" : "text-muted hover:text-white hover:bg-white/[0.07]"}`}
                        aria-label="Settings"
                    >
                        <Settings className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Settings</span>
                    </NavLink>
                </nav>
            </div>
        </header>
    );
}

function AppLayout() {
    const { auth, initStatus } = useNotion();

    if (!auth || initStatus === "error") return <Navigate to="/landing" replace />;

    if (initStatus !== "done") {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                    <p className="text-muted text-sm">Setting up workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <AppDataProvider>
            <div className="min-h-screen bg-surface text-white flex flex-col font-sans relative">
                {/* Background image and elements for Glassmorphism */}
                <div
                    className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 pointer-events-none"
                    style={{ backgroundImage: `url('/images/bull-bg.png')` }}
                />
                <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-900/10 blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[120px]" />
                </div>

                <AppNav />
                {/* Main Content */}
                <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto pb-28 sm:pb-0 sm:pt-28">
                    <Outlet />
                </main>
            </div>
        </AppDataProvider>
    );
}

export default AppLayout;
