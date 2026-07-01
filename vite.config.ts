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
    // Pin the dev port so it always matches the registered OAuth redirect URI
    // (http://localhost:4152/auth/notion/callback). strictPort fails loudly if
    // 4152 is taken instead of silently moving to 4153 and breaking the callback.
    server: {
        port: 4152,
        strictPort: true,
    },
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
                // Single origin: the SW must NOT serve index.html for the Worker's
                // own routes, or it swallows the OAuth callback / API and the SPA
                // renders its 404. Let these navigations hit the network (Worker).
                navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/health$/],
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
    // Pre-bundle these up front so Vitest's browser-mode Vite server doesn't
    // discover them mid-run and reload — a reload flakily aborts the in-flight
    // test-file imports in clean CI (react-dom/client + react-router-dom were the
    // culprits; the local .vite cache masked it).
    optimizeDeps: {
        include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "react-router-dom"],
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
