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

    const encoded = btoa(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`);

    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Basic ${encoded}`,
        },
        body: JSON.stringify({
            grant_type: "authorization_code",
            code,
            redirect_uri: `${url.origin}/auth/notion/callback`,
        }),
    });

    if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error("Token exchange failed:", errBody);
        const target = new URL("/", env.FRONTEND_URL);
        target.searchParams.set("error", "token_exchange_failed");
        return Response.redirect(target.toString(), 302);
    }

    const data = (await tokenRes.json()) as {
        access_token: string;
        workspace_name?: string;
        workspace_id?: string;
        bot_id?: string;
    };

    const callbackUrl = new URL("/callback", env.FRONTEND_URL);
    callbackUrl.searchParams.set("access_token", data.access_token);
    if (data.workspace_name) callbackUrl.searchParams.set("workspace_name", data.workspace_name);
    if (data.workspace_id) callbackUrl.searchParams.set("workspace_id", data.workspace_id);

    return Response.redirect(callbackUrl.toString(), 302);
}
