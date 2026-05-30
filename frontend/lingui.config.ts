import { defineConfig } from "@lingui/cli";

export default defineConfig({
    locales: ["en", "zh-TW"],
    sourceLocale: "en",
    compileNamespace: "es",
    catalogs: [{
        path: "<rootDir>/src/locales/{locale}/messages",
        include: ["<rootDir>/src"],
        exclude: ["**/node_modules/**"],
    }],
});
