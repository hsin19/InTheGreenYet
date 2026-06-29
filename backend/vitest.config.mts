import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [
        cloudflareTest({
            // Use the `dev` environment so the test worker omits the VPC binding.
            // A `remote` VPC binding can't be established in CI (no login) and
            // fails pool startup, exactly like `wrangler dev`. See wrangler.jsonc.
            wrangler: { configPath: "./wrangler.jsonc", environment: "dev" },
        }),
    ],
    test: {
        coverage: {
            // workerd runtime lacks the node inspector Session API that v8
            // coverage needs, so the workers pool must use istanbul.
            provider: "istanbul",
            reporter: ["text", "text-summary", "html", "lcov"],
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.test.ts", "src/env.d.ts"],
        },
    },
});
