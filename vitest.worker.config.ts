import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Worker integration tests run inside workerd via the Cloudflare Workers pool.
// Kept separate from vite.config.ts (the SPA dev/build + browser/node test
// config) so the workerd pool never mixes with the browser provider.
export default defineConfig({
    plugins: [
        cloudflareTest({
            // Use the `dev` environment so the test worker omits the VPC binding.
            // A `remote` VPC binding can't be established in CI (no login) and
            // fails pool startup, exactly like `wrangler dev`. See wrangler.jsonc.
            wrangler: { configPath: "./wrangler.jsonc", environment: "dev" },
            // Deterministic secret values for the worker pool so tests assert real
            // values (not the CI tautology where env vars are absent).
            miniflare: {
                bindings: {
                    NOTION_CLIENT_ID: "test-client-id",
                    NOTION_CLIENT_SECRET: "test-secret-shhh",
                },
            },
        }),
    ],
    test: {
        include: ["worker/**/*.test.ts"],
        coverage: {
            // workerd runtime lacks the node inspector Session API that v8
            // coverage needs, so the workers pool must use istanbul.
            provider: "istanbul",
            reportsDirectory: "./coverage-worker",
            reporter: ["text", "text-summary", "html", "lcov"],
            include: ["worker/**/*.ts"],
            exclude: ["worker/**/*.test.ts", "worker/env.d.ts", "worker/test/**"],
        },
    },
});
