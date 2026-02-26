import {
    BrowserRouter,
    Route,
    Routes,
} from "react-router-dom";
import { NotionProvider } from "./hooks/useNotion";
import Callback from "./pages/Callback";
import Home from "./pages/Home";

function App() {
    return (
        <NotionProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/callback" element={<Callback />} />
                </Routes>
            </BrowserRouter>
        </NotionProvider>
    );
}

export default App;
