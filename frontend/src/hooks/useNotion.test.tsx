import { renderWithI18n } from "@/test/render";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";
import { page } from "vitest/browser";
import {
    NotionProvider,
    useNotion,
} from "./useNotion";

const AUTH_KEY = "notion_auth";

function Consumer() {
    const { auth, logout, setAuthData } = useNotion();
    return (
        <div>
            <span data-testid="name">{auth?.workspace_name ?? "anon"}</span>
            <button onClick={() => setAuthData({ access_token: "tok", workspace_name: "Acme", workspace_id: "ws1" })}>
                set
            </button>
            <button onClick={logout}>out</button>
        </div>
    );
}

beforeEach(() => {
    localStorage.removeItem(AUTH_KEY);
});

afterEach(() => {
    localStorage.removeItem(AUTH_KEY);
});

describe("useNotion", () => {
    it("starts anonymous when nothing is stored", async () => {
        renderWithI18n(
            <NotionProvider>
                <Consumer />
            </NotionProvider>,
        );
        await expect.element(page.getByTestId("name")).toHaveTextContent("anon");
    });

    it("hydrates auth from localStorage on mount", async () => {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: "t", workspace_name: "Stored" }));
        renderWithI18n(
            <NotionProvider>
                <Consumer />
            </NotionProvider>,
        );
        await expect.element(page.getByTestId("name")).toHaveTextContent("Stored");
    });

    it("recovers from corrupt stored auth by clearing it", async () => {
        localStorage.setItem(AUTH_KEY, "{not json");
        renderWithI18n(
            <NotionProvider>
                <Consumer />
            </NotionProvider>,
        );
        await expect.element(page.getByTestId("name")).toHaveTextContent("anon");
        expect(localStorage.getItem(AUTH_KEY)).toBeNull();
    });

    it("setAuthData persists and exposes the new auth", async () => {
        renderWithI18n(
            <NotionProvider>
                <Consumer />
            </NotionProvider>,
        );
        await page.getByText("set", { exact: true }).click();

        await expect.element(page.getByTestId("name")).toHaveTextContent("Acme");
        expect(JSON.parse(localStorage.getItem(AUTH_KEY)!)).toMatchObject({ workspace_id: "ws1" });
    });

    it("logout clears stored auth and resets to anonymous", async () => {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: "t", workspace_name: "Stored", workspace_id: "ws9" }));
        renderWithI18n(
            <NotionProvider>
                <Consumer />
            </NotionProvider>,
        );
        await expect.element(page.getByTestId("name")).toHaveTextContent("Stored");

        await page.getByText("out", { exact: true }).click();

        await expect.element(page.getByTestId("name")).toHaveTextContent("anon");
        expect(localStorage.getItem(AUTH_KEY)).toBeNull();
    });
});
