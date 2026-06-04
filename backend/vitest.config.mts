import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [
        cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
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
