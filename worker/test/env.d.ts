// The cloudflare:test runtime exports (env, SELF, createExecutionContext, ...)
// live in the package's "./types" subpath, not its main entry, so load them here.
/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare module "cloudflare:test" {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProvidedEnv extends Env {}
}
