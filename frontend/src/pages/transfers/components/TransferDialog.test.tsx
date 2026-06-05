import {
    type AccountConfig,
    AppDataProvider,
} from "@/hooks/useAppData";
import { NotionProvider } from "@/hooks/useNotion";
import { renderWithI18n } from "@/test/render";
import { useState } from "react";
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { page } from "vitest/browser";
import { TransferDialog } from "./TransferDialog";

const AUTH_KEY = "notion_auth";

// Minimal Notion relay mock so addTransfer (via the store) resolves offline.
function installFetch() {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/transfers") && method === "POST") {
            return new Response(JSON.stringify({ id: "new-id" }), { status: 200 });
        }
        if (url.includes("/api/transfers")) return new Response(JSON.stringify({ transfers: [] }), { status: 200 });
        if (url.includes("/api/config")) return new Response(JSON.stringify({ config: [] }), { status: 200 });
        if (url.includes("currency-api")) return new Response(JSON.stringify({ date: "x", twd: {} }), { status: 200 });
        return new Response(JSON.stringify({}), { status: 200 });
    });
}

let wsCounter = 0;
function authenticate() {
    wsCounter += 1;
    localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: "tok", workspace_id: `td-ws-${wsCounter}` }));
}

interface HarnessProps {
    accounts?: Record<string, AccountConfig>;
    getFiatToBaseRate?: (c: string) => number | null;
}

// Wraps the dialog with real providers and tracks open state so closing works.
function Harness({ accounts = {}, getFiatToBaseRate = () => null }: HarnessProps) {
    const [open, setOpen] = useState(true);
    return (
        <NotionProvider>
            <AppDataProvider>
                <div>
                    <span data-testid="open">{String(open)}</span>
                    <TransferDialog
                        open={open}
                        onOpenChange={setOpen}
                        currencies={["USD", "TWD"]}
                        accounts={accounts}
                        baseCurrency="TWD"
                        getFiatToBaseRate={getFiatToBaseRate}
                    />
                </div>
            </AppDataProvider>
        </NotionProvider>
    );
}

async function pickCurrency(value: string) {
    await page.getByRole("combobox", { name: /currency/i }).click();
    await page.getByRole("option", { name: value, exact: true }).click();
}

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(AUTH_KEY);
});

describe("TransferDialog", () => {
    it("validates required fields in order", async () => {
        installFetch();
        authenticate();
        renderWithI18n(<Harness />);

        await expect.element(page.getByText("New Transfer")).toBeVisible();

        await page.getByRole("button", { name: "Save" }).click();
        await expect.element(page.getByText("From is required")).toBeVisible();

        await page.getByPlaceholder("Source").fill("bank");
        await page.getByRole("button", { name: "Save" }).click();
        await expect.element(page.getByText("To is required")).toBeVisible();

        await page.getByPlaceholder("Destination").fill("cash");
        await page.getByRole("button", { name: "Save" }).click();
        await expect.element(page.getByText("Amount is required")).toBeVisible();

        await page.getByLabelText("Amount").fill("100");
        await page.getByRole("button", { name: "Save" }).click();
        await expect.element(page.getByText("Currency is required")).toBeVisible();
    });

    it("saves a complete transfer and closes the dialog", async () => {
        const spy = installFetch();
        authenticate();
        renderWithI18n(<Harness />);

        await page.getByPlaceholder("Source").fill("bank");
        await page.getByPlaceholder("Destination").fill("cash");
        await page.getByLabelText("Amount").fill("250");
        await pickCurrency("USD");

        await page.getByRole("button", { name: "Save" }).click();

        await vi.waitFor(() => {
            const posted = spy.mock.calls.some(c =>
                (c[0] as string).includes("/api/transfers")
                && (c[1] as RequestInit)?.method === "POST"
            );
            expect(posted).toBe(true);
        });
        await expect.element(page.getByTestId("open")).toHaveTextContent("false");
    });

    it("shows the reference exchange rate for a non-base currency", async () => {
        installFetch();
        authenticate();
        renderWithI18n(<Harness getFiatToBaseRate={() => 31.5} />);

        await pickCurrency("USD");

        await expect.element(page.getByText("ref 31.5000")).toBeVisible();
    });

    it("renders account dropdowns when accounts exist", async () => {
        installFetch();
        authenticate();
        renderWithI18n(<Harness accounts={{ bank: { displayName: "My Bank" } }} />);

        // hasAccounts branch renders a combobox instead of a free-text input.
        await expect.element(page.getByRole("combobox", { name: /from/i })).toBeVisible();
    });
});
