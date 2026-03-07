import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
} from "react-router-dom";
import { NotionProvider } from "./hooks/useNotion";
import AppLayout from "./layouts/AppLayout";
import Accounts from "./pages/accounts";
import Callback from "./pages/Callback";
import Config from "./pages/Config";
import Landing from "./pages/Landing";
import Transfers from "./pages/Transfers";

function App() {
    return (
        <NotionProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/landing" element={<Landing />} />
                    <Route path="/callback" element={<Callback />} />
                    <Route element={<AppLayout />}>
                        <Route index element={<Navigate to="/accounts" replace />} />
                        <Route path="/transfers" element={<Transfers />} />
                        <Route path="/accounts" element={<Accounts />} />
                        <Route path="/config" element={<Config />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </NotionProvider>
    );
}

export default App;
