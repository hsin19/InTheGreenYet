import {
    lazy,
    Suspense,
} from "react";
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
} from "react-router-dom";
import { NotionProvider } from "./hooks/useNotion";
import AppLayout from "./layouts/AppLayout";

const Landing = lazy(() => import("./pages/Landing"));
const Callback = lazy(() => import("./pages/Callback"));
const Accounts = lazy(() => import("./pages/accounts"));
const Transfers = lazy(() => import("./pages/transfers"));
const Config = lazy(() => import("./pages/Config"));
const NotFound = lazy(() => import("./pages/NotFound"));

function App() {
    return (
        <NotionProvider>
            <BrowserRouter>
                <Suspense
                    fallback={
                        <div className="flex min-h-screen items-center justify-center">
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                                <p className="text-muted text-sm">Loading...</p>
                            </div>
                        </div>
                    }
                >
                    <Routes>
                        <Route path="/landing" element={<Landing />} />
                        <Route path="/callback" element={<Callback />} />
                        <Route element={<AppLayout />}>
                            <Route index element={<Navigate to="/accounts" replace />} />
                            <Route path="/transfers" element={<Transfers />} />
                            <Route path="/accounts" element={<Accounts />} />
                            <Route path="/config" element={<Config />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </NotionProvider>
    );
}

export default App;
