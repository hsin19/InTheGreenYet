import { renderWithI18n } from "@/test/render";
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { page } from "vitest/browser";
import {
    AppDataProvider,
    useAppData,
} from "./useAppData";
import { NotionProvider } from "./useNotion";

const AUTH_KEY = "notion_auth";

// Route every fetch the provider makes (Notion relay + the currency CDN) to a
// canned response so the full hydrate → revalidate → ready path runs offline.
function installFetch(transfers: unknown[]) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        const method = (init?.method ?? "GET").toUpperCase();

        if (url.includes("/api/transfers") && method === "GET") {
            return new Response(JSON.stringify({ transfers }), { status: 200 });
        }
        if (url.includes("/api/transfers") && method === "POST") {
            return new Response(JSON.stringify({ id: "new-id" }), { status: 200 });
        }
        if (url.includes("/api/config") && method === "GET") {
            return new Response(
                JSON.stringify({
                    config: [
                        { key: "baseCurrency", value: "TWD" },
                        { key: "currencies", value: ["USD", "TWD"] },
                        { key: "accounts", value: { cash: { displayName: "Wallet" } } },
                    ],
                }),
                { status: 200 },
            );
        }
        if (url.includes("/api/config") && method === "PUT") {
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (url.includes("/api/snapshots")) {
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        if (url.includes("currency-api")) {
            return new Response(JSON.stringify({ date: "2026-06-05", twd: { usd: 0.0314 } }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
    });
}

let wsCounter = 0;
function authenticate(): void {
    wsCounter += 1;
    localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({ access_token: "tok", workspace_id: `appdata-ws-${wsCounter}` }),
    );
}

function Consumer() {
    const d = useAppData();
    return (
        <div>
            <span data-testid="status">{d.status}</span>
            <span data-testid="count">{d.transfers.length}</span>
            <span data-testid="canwrite">{String(d.canWrite)}</span>
            <span data-testid="account">{d.getAccountName("cash")}</span>
            <span data-testid="account-unknown">{d.getAccountName("nope")}</span>
            <span data-testid="account-a">{d.getAccountName("a")}</span>
            <span data-testid="account-b">{d.getAccountName("b")}</span>
            <span data-testid="rate-base">{String(d.getFiatToBaseRate("TWD"))}</span>
            <span data-testid="rate-usd">{String(d.getFiatToBaseRate("USD"))}</span>
            <span data-testid="rate-empty">{String(d.getFiatToBaseRate(""))}</span>
            <button
                onClick={() =>
                    void d.addTransfer({
                        title: "x",
                        amount: 1,
                        currency: "USD",
                        fee: 0,
                        exchangeRate: null,
                        date: "2026-06-02",
                        from: "a",
                        to: "b",
                        note: "",
                    })}
            >
                add
            </button>
            <button onClick={() => void d.saveConfig("baseCurrency", "USD")}>save</button>
            <button onClick={() => void d.addSnapshots([{ account: "cash", date: "2026-06-02", amount: 5, currency: "USD" }])}>snap</button>
            <button
                onClick={() => {
                    // Two writes in the same render. Each must merge against the
                    // other's result, not the shared render-captured map.
                    void d.updateAccounts(curr => ({ ...curr, a: { displayName: "Acct A" } }));
                    void d.updateAccounts(curr => ({ ...curr, b: { displayName: "Acct B" } }));
                }}
            >
                concurrent-add
            </button>
        </div>
    );
}

function renderApp() {
    return renderWithI18n(
        <NotionProvider>
            <AppDataProvider>
                <Consumer />
            </AppDataProvider>
        </NotionProvider>,
    );
}

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(AUTH_KEY);
});

describe("useAppData", () => {
    it("hydrates config and transfers from the store and reaches ready", async () => {
        installFetch([{ id: "t1", title: "Salary", amount: 1, currency: "USD", fee: 0, exchangeRate: null, date: "2026-06-01", from: "a", to: "b", note: "" }]);
        authenticate();
        renderApp();

        await expect.element(page.getByTestId("status")).toHaveTextContent("ready");
        await expect.element(page.getByTestId("count")).toHaveTextContent("1");
        await expect.element(page.getByTestId("canwrite")).toHaveTextContent("true");
    });

    it("resolves account display names and falls back to the raw key", async () => {
        installFetch([]);
        authenticate();
        renderApp();

        await expect.element(page.getByTestId("status")).toHaveTextContent("ready");
        await expect.element(page.getByTestId("account")).toHaveTextContent("Wallet");
        await expect.element(page.getByTestId("account-unknown")).toHaveTextContent("nope");
    });

    it("computes fiat-to-base rates, with 1 for the base currency", async () => {
        installFetch([]);
        authenticate();
        renderApp();

        await expect.element(page.getByTestId("status")).toHaveTextContent("ready");
        await expect.element(page.getByTestId("rate-base")).toHaveTextContent("1");
        await expect.element(page.getByTestId("rate-empty")).toHaveTextContent("null");
        // 1 / 0.0314 ≈ 31.8 derived from the mocked currency feed.
        await expect.element(page.getByTestId("rate-usd")).toHaveTextContent("31.");
    });

    it("adds a transfer through the store and updates the list", async () => {
        installFetch([]);
        authenticate();
        renderApp();

        await expect.element(page.getByTestId("status")).toHaveTextContent("ready");
        await expect.element(page.getByTestId("count")).toHaveTextContent("0");

        await page.getByText("add", { exact: true }).click();
        await expect.element(page.getByTestId("count")).toHaveTextContent("1");
    });

    it("merges back-to-back account writes instead of clobbering one another", async () => {
        installFetch([]);
        authenticate();
        renderApp();

        await expect.element(page.getByTestId("status")).toHaveTextContent("ready");

        await page.getByText("concurrent-add", { exact: true }).click();

        // Without the configRef merge, the second write would start from the stale
        // render map and drop "a". Both must survive alongside the seeded "cash".
        await expect.element(page.getByTestId("account-a")).toHaveTextContent("Acct A");
        await expect.element(page.getByTestId("account-b")).toHaveTextContent("Acct B");
        await expect.element(page.getByTestId("account")).toHaveTextContent("Wallet");
    });

    it("saves config and posts snapshots without error", async () => {
        const spy = installFetch([]);
        authenticate();
        renderApp();

        await expect.element(page.getByTestId("status")).toHaveTextContent("ready");

        await page.getByText("save", { exact: true }).click();
        await page.getByText("snap", { exact: true }).click();

        await vi.waitFor(() => {
            const calls = spy.mock.calls.map(c => `${(c[1] as RequestInit)?.method ?? "GET"} ${c[0] as string}`);
            expect(calls.some(c => c.includes("PUT") && c.includes("/api/config"))).toBe(true);
            expect(calls.some(c => c.includes("/api/snapshots"))).toBe(true);
        });
    });
});
