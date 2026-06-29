import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { render as baseRender } from "vitest-browser-react";

// Activate an empty "en" catalog so `Trans`/`t` macros render their source text
// in component tests. This avoids importing the compiled `.po` catalogs (which
// rely on the lingui Vite plugin, disabled under Vitest) — the macro descriptors
// carry their source `message`, so lingui falls back to it when no entry exists.
i18n.load("en", {});
i18n.activate("en");

/** Render a component wrapped in the lingui provider, for i18n-aware components. */
export function renderWithI18n(ui: ReactNode) {
    return baseRender(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}
