import {
    afterEach,
    describe,
    expect,
    it,
} from "vitest";

// The compiled `.po` catalogs need the lingui Vite plugin (disabled under
// Vitest). Mock them so i18n.ts can be imported and its logic exercised.
import { vi } from "vitest";
vi.mock("./locales/en/messages.po", () => ({ messages: {} }));
vi.mock("./locales/zh-TW/messages.po", () => ({ messages: {} }));

const {
    getSelectedLocale,
    LOCALE_OPTIONS,
    setSelectedLocale,
} = await import("./i18n");

const KEY = "inthegreenyet_locale";

afterEach(() => {
    localStorage.removeItem(KEY);
});

describe("i18n locale selection", () => {
    it("exposes the auto/en/zh-TW options", () => {
        expect(LOCALE_OPTIONS.map(o => o.value)).toEqual(["auto", "en", "zh-TW"]);
    });

    it("defaults to auto when nothing is stored", () => {
        localStorage.removeItem(KEY);
        expect(getSelectedLocale()).toBe("auto");
    });

    it("returns the stored supported locale", () => {
        localStorage.setItem(KEY, "zh-TW");
        expect(getSelectedLocale()).toBe("zh-TW");

        localStorage.setItem(KEY, "en");
        expect(getSelectedLocale()).toBe("en");
    });

    it("treats an unrecognized stored value as auto", () => {
        localStorage.setItem(KEY, "fr");
        expect(getSelectedLocale()).toBe("auto");
    });

    it("persists an explicit locale and reflects it back", () => {
        setSelectedLocale("zh-TW");
        expect(localStorage.getItem(KEY)).toBe("zh-TW");
        expect(getSelectedLocale()).toBe("zh-TW");
    });

    it("clears storage when set back to auto", () => {
        setSelectedLocale("en");
        expect(localStorage.getItem(KEY)).toBe("en");

        setSelectedLocale("auto");
        expect(localStorage.getItem(KEY)).toBeNull();
        expect(getSelectedLocale()).toBe("auto");
    });
});
