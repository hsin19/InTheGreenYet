import { createClient } from "../notion";

export async function handleOAuthCallback(request: Request, url: URL, env: Env): Promise<Response> {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
        // Only the coarse `error` code is forwarded to the SPA (which maps it to a
        // localized message); log Notion's human-readable description for debugging.
        console.error("handleOAuthCallback provider error:", error, url.searchParams.get("error_description"));
        const target = new URL("/landing", url.origin);
        target.searchParams.set("error", error);
        return Response.redirect(target.toString(), 302);
    }

    if (!code) {
        return Response.json({ error: "Missing code parameter" }, { status: 400 });
    }

    const notion = createClient();

    try {
        const data = await notion.oauth.token({
            grant_type: "authorization_code",
            code,
            redirect_uri: `${url.origin}/auth/notion/callback`,
            client_id: env.NOTION_CLIENT_ID,
            client_secret: env.NOTION_CLIENT_SECRET,
        });

        const callbackUrl = new URL("/callback", url.origin);
        if (data.workspace_name) callbackUrl.searchParams.set("workspace_name", data.workspace_name);
        if (data.workspace_id) callbackUrl.searchParams.set("workspace_id", data.workspace_id);
        const state = url.searchParams.get("state");
        if (state) callbackUrl.searchParams.set("state", state);
        callbackUrl.hash = `access_token=${encodeURIComponent(data.access_token)}`;

        return Response.redirect(callbackUrl.toString(), 302);
    } catch (err) {
        console.error("handleOAuthCallback error:", err);
        const target = new URL("/landing", url.origin);
        target.searchParams.set("error", "token_exchange_failed");
        return Response.redirect(target.toString(), 302);
    }
}
