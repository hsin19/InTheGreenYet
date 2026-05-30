import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { I18nProvider } from "@lingui/react";
import App from "./App.tsx";
import { i18n } from "./i18n";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <I18nProvider i18n={i18n}>
            <App />
        </I18nProvider>
    </StrictMode>,
);
