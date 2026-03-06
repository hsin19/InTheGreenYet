import { createClient } from "../notion";

export async function handleOAuthCallback(request: Request, url: URL, env: Env): Promise<Response> {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
        const target = new URL("/", env.FRONTEND_URL);
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

        const callbackUrl = new URL("/callback", env.FRONTEND_URL);
        callbackUrl.searchParams.set("access_token", data.access_token);
        if (data.workspace_name) callbackUrl.searchParams.set("workspace_name", data.workspace_name);
        if (data.workspace_id) callbackUrl.searchParams.set("workspace_id", data.workspace_id);

        return Response.redirect(callbackUrl.toString(), 302);
    } catch (err) {
        console.error("Token exchange failed", err);
        const target = new URL("/", env.FRONTEND_URL);
        target.searchParams.set("error", "token_exchange_failed");
        return Response.redirect(target.toString(), 302);
    }
}
