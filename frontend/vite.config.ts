import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { imagetools } from "vite-imagetools";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
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
                background_color: "#0a0a0a",
                theme_color: "#0a0a0a",
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
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
});
