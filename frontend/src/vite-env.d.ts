/// <reference types="vite/client" />

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
