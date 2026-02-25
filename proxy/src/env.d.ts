// Extend auto-generated Env with Notion OAuth secrets (set via .dev.vars / wrangler secret)
interface Env {
    NOTION_CLIENT_ID: string;
    NOTION_CLIENT_SECRET: string;
}
