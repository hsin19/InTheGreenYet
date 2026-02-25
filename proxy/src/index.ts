import { searchDataSource, createTransactionDataSource } from "./notion";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// --- OAuth callback ---
		if (url.pathname === "/auth/notion/callback") {
			return handleOAuthCallback(request, url, env);
		}

		// --- Setup: find or create Transaction data source ---
		if (url.pathname === "/api/setup" && request.method === "POST") {
			return handleSetup(request, env);
		}

		// --- Health check ---
		return Response.json({ status: "ok", service: "inthegreen-proxy" });
	},
} satisfies ExportedHandler<Env>;

// ─── Setup handler ────────────────────────────────────────────

function getToken(request: Request): string {
	const auth = request.headers.get("Authorization");
	if (!auth?.startsWith("Bearer ")) {
		throw new Error("Missing Authorization header");
	}
	return auth.slice(7);
}

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

async function handleSetup(request: Request, env: Env): Promise<Response> {
	try {
		const token = getToken(request);

		// 1. Search for existing Transaction data source
		const existing = await searchDataSource(token, "Transaction");
		if (existing) {
			return jsonResponse({ transactionDataSourceId: existing.id, created: false });
		}

		// 2. Not found → create database + data source
		const result = await createTransactionDataSource(token);
		return jsonResponse({ transactionDataSourceId: result.dataSourceId, created: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return jsonResponse({ error: message }, 400);
	}
}

// ─── Helpers ──────────────────────────────────────────────────

/** Resolve the real client-facing origin (respects X-Forwarded-* from Vite proxy in dev). */
function getOrigin(request: Request, url: URL): string {
	const fwdHost = request.headers.get("X-Forwarded-Host");
	if (fwdHost) {
		const proto = request.headers.get("X-Forwarded-Proto") ?? "https";
		return `${proto}://${fwdHost}`;
	}
	return url.origin;
}

// ─── OAuth callback handler ───────────────────────────────────

async function handleOAuthCallback(request: Request, url: URL, env: Env): Promise<Response> {
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");

	// User denied access on Notion side
	if (error) {
		const target = new URL("/", getOrigin(request, url));
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
			redirect_uri: `${getOrigin(request, url)}/auth/notion/callback`,
		}),
	});

	if (!tokenRes.ok) {
		const errBody = await tokenRes.text();
		console.error("Token exchange failed:", errBody);
		const target = new URL("/", getOrigin(request, url));
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
	const callbackUrl = new URL("/callback", getOrigin(request, url));
	callbackUrl.searchParams.set("access_token", data.access_token);
	if (data.workspace_name) {
		callbackUrl.searchParams.set("workspace_name", data.workspace_name);
	}
	if (data.workspace_id) {
		callbackUrl.searchParams.set("workspace_id", data.workspace_id);
	}

	return Response.redirect(callbackUrl.toString(), 302);
}

