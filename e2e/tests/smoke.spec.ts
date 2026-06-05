import {
    expect,
    test,
} from "./fixtures";

// First-version smoke: the app boots, auth gates routing, and each main page
// renders. The final test depends on a successful browser → Worker → mock Notion
// round-trip (it waits for the "ready" empty state), so the suite fails if the
// Worker→Notion path is broken rather than passing on chrome alone.

test("unauthenticated visit redirects to the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/landing/);
    await expect(page.getByRole("button", { name: /Connect to Notion/i })).toBeVisible();
});

for (const path of ["/accounts", "/transfers", "/config"]) {
    test(`authenticated ${path} renders without crashing`, async ({ authedPage }) => {
        const pageErrors: Error[] = [];
        authedPage.on("pageerror", err => pageErrors.push(err));

        await authedPage.goto(path);

        // AppNav is rendered on every authenticated route as soon as auth is set,
        // independent of whether the data load succeeds.
        await expect(authedPage.getByRole("link", { name: "Accounts" })).toBeVisible();
        await expect(authedPage).toHaveURL(new RegExp(path));

        expect(pageErrors.map(e => e.message).join("\n")).toBe("");
    });
}

test("accounts data loads through the Worker → Notion path", async ({ authedPage }) => {
    await authedPage.goto("/accounts");

    // "No accounts yet." is the ready+empty state, reached only after the Worker
    // successfully queried (mock) Notion. A broken Worker→Notion path lands on
    // "Failed to load accounts" instead, failing these assertions.
    await expect(authedPage.getByText(/No accounts yet/i)).toBeVisible();
    await expect(authedPage.getByText(/Failed to load accounts/i)).toHaveCount(0);
});
