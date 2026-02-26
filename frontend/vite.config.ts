import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        proxy: {
            // Forward /auth/* and /api/* to the CF Worker proxy during dev
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
                headers: {
                    "X-Forwarded-Proto": "http",
                    "X-Forwarded-Host": "localhost:5173",
                },
            },
        },
    },
});
