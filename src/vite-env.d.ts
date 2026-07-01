/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// Injected by vite.config.ts `define`.
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

// Type declarations for vite-imagetools query string imports
declare module "*&imagetools" {
    /**
     * actual types
     * - code https://github.com/JonasKruckenberg/imagetools/blob/main/packages/core/src/output-formats.ts
     * - docs https://github.com/JonasKruckenberg/imagetools/blob/main/docs/guide/getting-started.md#metadata
     */
    const out: string;
    export default out;
}

declare module "*.po" {
    import type { Messages } from "@lingui/core";

    export const messages: Messages;
}
