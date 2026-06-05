import {
    type Page,
    test as base,
} from "@playwright/test";

// A fake Notion auth blob. The SPA reads this from localStorage (notion_auth) and
// from there drives the app — letting e2e skip the external Notion OAuth redirect.
export const E2E_AUTH = {
    access_token: "e2e-mock-token",
    workspace_id: "e2e-workspace",
    workspace_name: "E2E Workspace",
};

// `authedPage` is a Page pre-seeded with the auth blob before any navigation, so
// the app boots in its logged-in state.
export const test = base.extend<{ authedPage: Page; }>({
    authedPage: async ({ page }, use) => {
        await page.addInitScript(auth => {
            window.localStorage.setItem("notion_auth", JSON.stringify(auth));
        }, E2E_AUTH);
        await use(page);
    },
});

export { expect } from "@playwright/test";
