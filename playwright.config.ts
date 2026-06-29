import {
    defineConfig,
    devices,
} from "@playwright/test";

// E2E smoke: browser → real wrangler dev Worker → mock Notion.
// Three local servers are started by `webServer` below.
const FRONTEND_PORT = 4173;
const BACKEND_PORT = 8787;
const MOCK_NOTION_PORT = 8888;

const BASE_URL = `http://localhost:${FRONTEND_PORT}`;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const MOCK_NOTION_URL = `http://localhost:${MOCK_NOTION_PORT}`;

export default defineConfig({
    testDir: "./e2e/tests",
    outputDir: "./e2e/test-results",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI
        ? [["html", { outputFolder: "./e2e/playwright-report", open: "never" }], ["list"]]
        : [["html", { outputFolder: "./e2e/playwright-report", open: "never" }], ["list"]],
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
            // Real Worker via wrangler dev. CLI --var overrides any local .dev.vars.
            command: `pnpm --filter @inthegreenyet/backend exec wrangler dev --env dev --port ${BACKEND_PORT}`
                + ` --var NOTION_API_BASE_URL:${MOCK_NOTION_URL}`
                + ` --var FRONTEND_URL:${BASE_URL}`
                + ` --var NOTION_CLIENT_ID:e2e-dummy`
                + ` --var NOTION_CLIENT_SECRET:e2e-dummy`,
            url: `${BACKEND_URL}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
        {
            // Production build served by vite preview; API calls go cross-origin to
            // the Worker (no Vite proxy) and rely on the Worker's CORS headers.
            command: `pnpm --filter @inthegreenyet/frontend build`
                + ` && pnpm --filter @inthegreenyet/frontend preview --port ${FRONTEND_PORT} --strictPort`,
            url: BASE_URL,
            env: { VITE_API_BASE_URL: BACKEND_URL },
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
        },
    ],
});
