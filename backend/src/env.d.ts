// Notion OAuth secrets (set via .dev.vars locally / `wrangler secret` in prod).
// `wrangler types` only emits these when a local .dev.vars is present, so CI
// (which has none at typecheck time) generates an empty Env. Augment the shared
// `__BaseEnv_Env` base so BOTH the global `Env` and `Cloudflare.Env` (the type of
// the `cloudflare:workers` `env` export used in tests) inherit them.
interface __BaseEnv_Env {
    NOTION_CLIENT_ID: string;
    NOTION_CLIENT_SECRET: string;
    FRONTEND_URL: string;
}
