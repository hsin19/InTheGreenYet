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
        exclude: ["**/node_modules/**"],
    }],
});
