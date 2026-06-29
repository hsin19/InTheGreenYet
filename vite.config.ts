/// <reference types="vitest/config" />
import { cloudflare } from "@cloudflare/vite-plugin";
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
        // cloudflare() runs the Worker (with the ASSETS binding) in dev/build on a
        // single origin — not wanted under Vitest, which would otherwise spin up
        // workerd. lingui() loads the .po catalogs at build time and resolves its
        // config from process.cwd(), which breaks test runners; the SWC macro above
        // still applies, so skip both plugins under "test".
        ...(mode === "test" ? [] : [cloudflare(), lingui()]),
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
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@shared": path.resolve(__dirname, "./shared"),
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
                // Fast pure-logic tests in Node (lib helpers, exchange math, ...).
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
                "src/test/**",
            ],
        },
    },
}));
