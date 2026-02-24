export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// --- OAuth callback ---
		if (url.pathname === "/auth/notion/callback") {
			return handleOAuthCallback(url, env);
		}

		// --- CORS preflight ---
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: corsHeaders(env.FRONTEND_URL),
			});
		}

		// --- Health check ---
		return Response.json({ status: "ok", service: "inthegreen-proxy" });
	},
} satisfies ExportedHandler<Env>;

// ─── OAuth callback handler ───────────────────────────────────

async function handleOAuthCallback(url: URL, env: Env): Promise<Response> {
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");

	// User denied access on Notion side
	if (error) {
		const target = new URL(env.FRONTEND_URL);
		target.searchParams.set("error", error);
		return Response.redirect(target.toString(), 302);
	}

	if (!code) {
		return Response.json({ error: "Missing code parameter" }, { status: 400 });
	}

	// Exchange authorization code for access token
	const encoded = btoa(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`);

	const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			Authorization: `Basic ${encoded}`,
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
		const target = new URL(env.FRONTEND_URL);
		target.searchParams.set("error", "token_exchange_failed");
		return Response.redirect(target.toString(), 302);
	}

	const data = (await tokenRes.json()) as {
		access_token: string;
		workspace_name?: string;
		workspace_id?: string;
		bot_id?: string;
	};

	// Redirect back to frontend /callback with token info
	const callbackUrl = new URL("/callback", env.FRONTEND_URL);
	callbackUrl.searchParams.set("access_token", data.access_token);
	if (data.workspace_name) {
		callbackUrl.searchParams.set("workspace_name", data.workspace_name);
	}
	if (data.workspace_id) {
		callbackUrl.searchParams.set("workspace_id", data.workspace_id);
	}

	return Response.redirect(callbackUrl.toString(), 302);
}

// ─── CORS helpers ─────────────────────────────────────────────

function corsHeaders(origin: string): HeadersInit {
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
	};
}
