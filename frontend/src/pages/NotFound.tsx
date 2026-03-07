import { Home } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFound() {
    return (
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16 text-center">
            <span className="text-6xl mb-4">🛸</span>
            <h1 className="text-4xl font-bold text-white mb-2">404</h1>
            <h2 className="text-xl font-semibold text-white/80 mb-4">Page Not Found</h2>
            <p className="text-muted text-sm max-w-sm mb-8">
                Oops! Looks like you've wandered into uncharted territory. The page you're looking for doesn't exist.
            </p>
            <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-colors"
            >
                <Home className="w-4 h-4" />
                Return to Safety
            </Link>
        </div>
    );
}

export default NotFound;
