import { AppDataProvider } from "@/hooks/useAppData";
import { NotionProvider } from "@/hooks/useNotion";
import { renderWithI18n } from "@/test/render";
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

// i18n.ts pulls in compiled `.po` catalogs, which the lingui Vite plugin (off
// under Vitest) would normally transform. Mock the module so Config can mount.
const setSelectedLocale = vi.fn();
vi.mock("@/i18n", () => ({
    getSelectedLocale: () => "auto",
    setSelectedLocale: (v: string) => setSelectedLocale(v),
    LOCALE_OPTIONS: [
        { value: "auto", label: "Auto" },
        { value: "en", label: "English" },
        { value: "zh-TW", label: "繁體中文" },
    ],
}));

const { default: Config } = await import("./Config");

const AUTH_KEY = "notion_auth";

function installFetch() {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/transfers")) return new Response(JSON.stringify({ transfers: [] }), { status: 200 });
        if (url.includes("/api/config") && method === "PUT") return new Response(JSON.stringify({ ok: true }), { status: 200 });
        if (url.includes("/api/config")) {
            return new Response(
                JSON.stringify({ config: [{ key: "baseCurrency", value: "USD" }, { key: "currencies", value: ["USD", "TWD"] }] }),
                { status: 200 },
            );
        }
        if (url.includes("currency-api")) {
            return new Response(JSON.stringify({ date: "2026-06-05", usd: { eur: 0.9, jpy: 150, twd: 31 } }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
    });
}

let wsCounter = 0;
function authenticate() {
    wsCounter += 1;
    localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: "tok", workspace_name: "Acme", workspace_id: `cfg-ws-${wsCounter}` }));
}

function renderConfig() {
    return renderWithI18n(
        <NotionProvider>
            <AppDataProvider>
                <Config />
            </AppDataProvider>
        </NotionProvider>,
    );
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    setSelectedLocale.mockClear();
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem("inthegreenyet_exchange_rates_usd");
});

describe("Config page", () => {
    // Runs first so the DOM is clean — Radix portals from later tests would
    // otherwise leave stray "Log out" matches behind.
    it("logs out through the confirmation dialog", async () => {
        installFetch();
        authenticate();
        renderConfig();

        await expect.element(page.getByRole("heading", { name: "Notion Workspace" })).toBeVisible();
        await page.getByRole("button", { name: "Log out" }).first().click();
        await expect.element(page.getByText("Log out of Notion?")).toBeVisible();
        // The dialog's destructive action is the last "Log out" button.
        await page.getByRole("button", { name: "Log out" }).last().click();

        await vi.waitFor(() => {
            expect(localStorage.getItem(AUTH_KEY)).toBeNull();
        });
    });

    it("renders the settings sections once data is ready", async () => {
        installFetch();
        authenticate();
        renderConfig();

        await expect.element(page.getByText("Settings")).toBeVisible();
        await expect.element(page.getByRole("heading", { name: "Currencies" })).toBeVisible();
        // Existing currency chips render from the loaded config.
        await expect.element(page.getByRole("button", { name: "Remove TWD" })).toBeVisible();
    });

    it("adds and removes a currency chip", async () => {
        installFetch();
        authenticate();
        renderConfig();

        const input = page.getByLabelText("Add Currency", { exact: true });
        await expect.element(input).toBeVisible();
        await input.fill("EUR");
        await page.getByRole("button", { name: "Add currency button" }).click();

        await expect.element(page.getByRole("button", { name: "Remove EUR" })).toBeVisible();

        await page.getByRole("button", { name: "Remove EUR" }).click();
        await expect.element(page.getByRole("button", { name: "Remove EUR" })).not.toBeInTheDocument();
    });

    it("rejects an unsupported currency", async () => {
        installFetch();
        authenticate();
        renderConfig();

        const input = page.getByLabelText("Add Currency", { exact: true });
        await expect.element(input).toBeVisible();
        await input.fill("ZZZ");
        await page.getByRole("button", { name: "Add currency button" }).click();

        await expect.element(page.getByText(/not a supported currency/)).toBeVisible();
    });

    it("saves the base currency on Enter", async () => {
        const spy = installFetch();
        authenticate();
        renderConfig();

        const input = page.getByLabelText("Base Currency");
        await expect.element(input).toBeVisible();
        await input.fill("EUR");
        await input.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

        await vi.waitFor(() => {
            const saved = spy.mock.calls.some(c =>
                (c[0] as string).includes("/api/config")
                && (c[1] as RequestInit)?.method === "PUT"
                && String((c[1] as RequestInit)?.body).includes("baseCurrency")
            );
            expect(saved).toBe(true);
        });
    });

    it("persists a language change", async () => {
        installFetch();
        authenticate();
        renderConfig();

        await expect.element(page.getByText("Settings")).toBeVisible();
        await page.getByRole("combobox").first().click();
        await page.getByRole("option", { name: "English" }).click();

        expect(setSelectedLocale).toHaveBeenCalledWith("en");
    });
});
