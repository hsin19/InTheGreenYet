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
    await expect(page.getByRole("link", { name: /Connect to Notion/i })).toBeVisible();
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

// Exercises the single-origin routing layer that worker.fetch() unit tests can't
// reach: run_worker_first sends /api/* to the Worker (404 returned verbatim, not
// rewritten), while unknown client routes fall back to index.html for the SPA.
test("single-origin routing: unknown /api hits the Worker 404, unknown client route serves the SPA", async ({ page }) => {
    const api = await page.request.get("/api/does-not-exist");
    expect(api.status()).toBe(404);

    const client = await page.request.get("/accounts/does-not-exist");
    expect(client.status()).toBe(200);
    expect(client.headers()["content-type"]).toContain("text/html");
});

test("accounts data loads through the Worker → Notion path", async ({ authedPage }) => {
    await authedPage.goto("/accounts");

    // "No accounts yet." is the ready+empty state, reached only after the Worker
    // successfully queried (mock) Notion. A broken Worker→Notion path lands on
    // "Failed to load accounts" instead, failing these assertions.
    await expect(authedPage.getByText(/No accounts yet/i)).toBeVisible();
    await expect(authedPage.getByText(/Failed to load accounts/i)).toHaveCount(0);
});
