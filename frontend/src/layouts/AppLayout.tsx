import {
    Navigate,
    NavLink,
    Outlet,
} from "react-router-dom";
import { useNotion } from "../hooks/useNotion";
import { AppDataProvider } from "../hooks/useAppData";

function AppNav() {
    const { auth, logout } = useNotion();

    return (
        <header className="fixed top-0 inset-x-0 h-14 flex items-center justify-between px-6 border-b border-white/10 bg-surface/80 backdrop-blur z-10">
            <span className="font-semibold text-white text-sm">InTheGreenYet</span>
            <nav className="flex items-center gap-6">
                <NavLink
                    to="/transfers"
                    className={({ isActive }) => `text-sm transition-colors ${isActive ? "text-white font-medium" : "text-muted hover:text-white"}`}
                >
                    Transfers
                </NavLink>
                <NavLink
                    to="/net-cost"
                    className={({ isActive }) => `text-sm transition-colors ${isActive ? "text-white font-medium" : "text-muted hover:text-white"}`}
                >
                    Net Cost
                </NavLink>
            </nav>
            <button
                onClick={logout}
                className="text-sm text-muted hover:text-white transition-colors cursor-pointer"
            >
                {auth?.workspace_name ?? "Disconnect"}
                <span className="ml-2 text-muted/50">↩</span>
            </button>
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
            <div className="pt-14">
                <AppNav />
                <Outlet />
            </div>
        </AppDataProvider>
    );
}

export default AppLayout;
