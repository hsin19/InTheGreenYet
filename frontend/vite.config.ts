/// <reference types="vitest/config" />
import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { playwright } from "@vitest/browser-playwright";
import path from "path";
import { defineConfig } from "vite";
import { imagetools } from "vite-imagetools";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [
        react({
            plugins: [["@lingui/swc-plugin", {}]],
        }),
        // The lingui Vite plugin resolves lingui.config.ts from process.cwd(),
        // which breaks when a runner (e.g. the VS Code Vitest extension) loads
        // this config from the repo root. Tests don't import message catalogs,
        // so skip it under Vitest; the SWC macro transform above still applies.
        ...(mode === "test" ? [] : [lingui()]),
        tailwindcss(),
        imagetools(),
        VitePWA({
            registerType: "autoUpdate",
            pwaAssets: {
                disabled: false,
                config: true,
            },
            manifest: {
                name: "InTheGreenYet",
                short_name: "InTheGreenYet",
                background_color: "#0f1117",
                theme_color: "#0f1117",
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,svg,png,ico,webp}"],
                cleanupOutdatedCaches: true,
            },
            devOptions: {
                enabled: false,
                navigateFallback: "index.html",
                suppressWarnings: true,
                type: "module",
            },
        }),
    ],
    server: {
        proxy: {
            // Forward /auth/* and /api/* to the CF Worker backend during dev
            "/auth": {
                target: "http://localhost:8787",
                changeOrigin: true,
                headers: {
                    "X-Forwarded-Proto": "http",
                    "X-Forwarded-Host": "localhost:5173",
                },
            },
            "/api": {
                target: "http://localhost:8787",
                changeOrigin: true,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(id)) {
                        return "react";
                    }
                },
            },
        },
    },
    test: {
        projects: [
            {
                // Fast pure-logic tests in Node (lib helpers, signing clients, ...).
                extends: true,
                test: {
                    name: "unit",
                    environment: "node",
                    include: ["src/**/*.test.ts"],
                },
            },
            {
                // Component tests in a real browser via Playwright/Chromium.
                extends: true,
                test: {
                    name: "browser",
                    include: ["src/**/*.test.tsx"],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        instances: [{ browser: "chromium" }],
                    },
                },
            },
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "text-summary", "html", "lcov"],
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/**/*.test.{ts,tsx}",
                "src/**/*.d.ts",
                "src/main.tsx",
                "src/components/ui/**",
            ],
        },
    },
}));
