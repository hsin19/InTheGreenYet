import { i18n } from "@lingui/core";
import { messages as enMessages } from "./locales/en/messages.po";
import { messages as zhTwMessages } from "./locales/zh-TW/messages.po";

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

type SupportedLocale = "en" | "zh-TW";
export type SelectedLocale = "auto" | SupportedLocale;

interface LocaleOption {
    value: SelectedLocale;
    label: string | MessageDescriptor;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
    { value: "auto", label: msg`Auto (Browser Default)` },
    { value: "en", label: "English" },
    { value: "zh-TW", label: "繁體中文" },
];

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

function activateLocale(locale: SupportedLocale) {
    i18n.load(locale, localeMessages[locale]);
    i18n.activate(locale);
}

export function getSelectedLocale(): SelectedLocale {
    if (typeof window === "undefined") return "auto";
    const stored = window.localStorage.getItem(localeStorageKey);
    if (stored === "en" || stored === "zh-TW") return stored;
    return "auto";
}

function activateSelectedLocale(locale: SelectedLocale) {
    let resolvedLocale: SupportedLocale;
    if (locale === "auto") {
        const browserLocale = typeof navigator !== "undefined"
            ? normalizeLocale(navigator.language)
            : null;
        resolvedLocale = browserLocale ?? defaultLocale;
    } else {
        resolvedLocale = locale;
    }

    activateLocale(resolvedLocale);
}

export function setSelectedLocale(locale: SelectedLocale) {
    if (typeof window !== "undefined") {
        if (locale === "auto") {
            window.localStorage.removeItem(localeStorageKey);
        } else {
            window.localStorage.setItem(localeStorageKey, locale);
        }
    }

    activateSelectedLocale(locale);
}

// Initialize
activateSelectedLocale(getSelectedLocale());

export { i18n };
