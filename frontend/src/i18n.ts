import { i18n } from "@lingui/core";
import { messages as enMessages } from "./locales/en/messages.po";
import { messages as zhTwMessages } from "./locales/zh-TW/messages.po";

type SupportedLocale = "en" | "zh-TW";

const defaultLocale: SupportedLocale = "en";
const localeStorageKey = "inthegreenyet_locale";

const localeMessages = {
    "en": enMessages,
    "zh-TW": zhTwMessages,
} satisfies Record<SupportedLocale, typeof enMessages>;

function normalizeLocale(locale: string | null | undefined): SupportedLocale | null {
    if (!locale) return null;
    const normalized = locale.toLowerCase();
    if (normalized === "zh-tw" || normalized.startsWith("zh")) return "zh-TW";
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
    return null;
}

function getInitialLocale(): SupportedLocale {
    const stored = typeof window !== "undefined"
        ? normalizeLocale(window.localStorage.getItem(localeStorageKey))
        : null;
    if (stored) return stored;

    const browserLocale = typeof navigator !== "undefined"
        ? normalizeLocale(navigator.language)
        : null;
    return browserLocale ?? defaultLocale;
}

function activateLocale(locale: SupportedLocale) {
    i18n.load(locale, localeMessages[locale]);
    i18n.activate(locale);
}

activateLocale(getInitialLocale());

export { i18n };
