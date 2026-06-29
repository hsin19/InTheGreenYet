/**
 * Build the Notion OAuth authorize URL the browser redirects to. Pure (no
 * window/storage access) so it is unit-testable in Node, while useNotion.login
 * stays the thin side-effecting wrapper (fetch client id, set state, navigate).
 */
export function buildNotionAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
        owner: "user",
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
    });
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}
