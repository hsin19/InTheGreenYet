import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
} from "react-router-dom";
import { NotionProvider } from "./hooks/useNotion";
import AppLayout from "./layouts/AppLayout";
import Callback from "./pages/Callback";
import Landing from "./pages/Landing";
import NetCost from "./pages/NetCost";
import Transfers from "./pages/Transfers";

function App() {
    return (
        <NotionProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/landing" element={<Landing />} />
                    <Route path="/callback" element={<Callback />} />
                    <Route element={<AppLayout />}>
                        <Route index element={<Navigate to="/transfers" replace />} />
                        <Route path="/transfers" element={<Transfers />} />
                        <Route path="/net-cost" element={<NetCost />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </NotionProvider>
    );
}

export default App;
