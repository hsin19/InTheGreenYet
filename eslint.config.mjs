import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import {
    defineConfig,
    globalIgnores,
} from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
    globalIgnores([
        "dist",
        "node_modules",
        ".wrangler",
        "**/coverage",
        "coverage-worker",
        "**/worker-configuration.d.ts",
        "src/locales/**/messages.js",
        "src/locales/**/messages.mjs",
    ]),
    {
        // Frontend (React SPA) specific configuration
        files: ["src/**/*.{ts,tsx}"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        rules: {
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                destructuredArrayIgnorePattern: "^_",
            }],
        },
    },
    {
        // Backend (Cloudflare Worker) + shared contract types
        files: ["worker/**/*.ts", "shared/**/*.ts"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
        ],
        languageOptions: {
            ecmaVersion: 2022,
            globals: {
                ...globals.node,
                ...globals.worker,
            },
        },
        rules: {
            // Workers often have unused ctx in fetch handlers
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
]);
