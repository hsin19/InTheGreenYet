import {
    BrowserRouter,
    Route,
    Routes,
} from "react-router-dom";
import { NotionProvider } from "./hooks/useNotion";
import Callback from "./pages/Callback";
import Home from "./pages/Home";
import Transfers from "./pages/Transfers";

function App() {
    return (
        <NotionProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/callback" element={<Callback />} />
                    <Route path="/transfers" element={<Transfers />} />
                </Routes>
            </BrowserRouter>
        </NotionProvider>
    );
}

export default App;
