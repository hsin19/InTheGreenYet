import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

export default defineConfig({
    locales: ["en", "zh-TW"],
    sourceLocale: "en",
    compileNamespace: "es",
    format: formatter({ lineNumbers: false }),
    catalogs: [{
        path: "<rootDir>/src/locales/{locale}/messages",
        include: ["<rootDir>/src"],
        // __screenshots__ holds vitest-browser artifacts in dirs named like the
        // test file (e.g. useAppData.test.tsx/) — without this the extractor tries
        // to read those dirs as .tsx files and crashes with EISDIR.
        exclude: ["**/node_modules/**", "**/__screenshots__/**", "**/*.test.{ts,tsx}"],
    }],
});
