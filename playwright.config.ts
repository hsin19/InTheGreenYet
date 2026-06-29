import {
    defineConfig,
    devices,
} from "@playwright/test";

// E2E smoke: browser → single-origin Worker (SPA assets + /api + /auth) → mock Notion.
// Two local servers are started by `webServer` below:
//  1. the mock Notion API (the Worker's NOTION_API_BASE_URL points here), and
//  2. the built app served by `wrangler dev`, which serves the Vite client build
//     AND the Worker on ONE origin via the assets binding — the same shape as prod.
const APP_PORT = 4173;
const MOCK_NOTION_PORT = 8888;

const BASE_URL = `http://localhost:${APP_PORT}`;
const MOCK_NOTION_URL = `http://localhost:${MOCK_NOTION_PORT}`;

export default defineConfig({
    testDir: "./e2e/tests",
    outputDir: "./e2e/test-results",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [["html", { outputFolder: "./e2e/playwright-report", open: "never" }], ["list"]],
    use: {
        baseURL: BASE_URL,
        trace: "on-first-retry",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ],
    webServer: [
        {
            // Mock Notion API — the Worker's NOTION_API_BASE_URL points here.
            command: "node e2e/mock-notion/server.mjs",
            url: `${MOCK_NOTION_URL}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
        },
        {
            // Build the SPA + Worker, then serve both on ONE origin via wrangler dev.
            // The @cloudflare/vite-plugin build emits a redirect config carrying the
            // assets directory, so `wrangler dev` serves the client build too. --var
            // overrides inject the mock Notion URL and dummy secrets (no .dev.vars
            // needed in CI). VITE_API_BASE_URL is unset, so the SPA calls /api
            // same-origin.
            command: `pnpm exec vite build`
                + ` && pnpm exec wrangler dev --port ${APP_PORT} --ip 127.0.0.1`
                + ` --var NOTION_API_BASE_URL:${MOCK_NOTION_URL}`
                + ` --var NOTION_CLIENT_ID:e2e-dummy`
                + ` --var NOTION_CLIENT_SECRET:e2e-dummy`,
            url: `${BASE_URL}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
        },
    ],
});
