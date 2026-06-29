/**
 * Transport for outbound exchange calls.
 *
 * Some exchange APIs (MAX, Binance) block Cloudflare's egress IPs but allow
 * residential ones. In prod we tunnel those calls through a relay (a Workers VPC
 * binding) that re-issues the request from a home broadband IP.
 *
 * The relay forwards the path + query untouched and only strips its own control
 * headers, so request *signing* is unaffected: we still build the real upstream
 * URL in each provider module and just swap the transport here.
 */
export type Send = (url: string, init?: RequestInit) => Promise<Response>;

/** Cap on a single relay round-trip (Worker → relay → exchange → back). Aligned
 *  with Binance's 10s recvWindow: a slower relay would fail the signature anyway. */
const RELAY_TIMEOUT_MS = 10_000;

/**
 * Raised when the relay itself is unreachable (down/timed out), as opposed to the
 * exchange rejecting the request. Surfaces as a 500 so it isn't mistaken for a
 * credential error.
 */
export class RelayError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RelayError";
    }
}

/**
 * Returns a `fetch`-shaped transport. With the RELAY binding present (prod) the
 * target host is moved into `X-Upstream-Host` and the URL host is rewritten to
 * the VPC service — which ignores it and routes to the configured relay:80.
 * Without it (local dev / tests) we already run on a residential IP, so fall
 * back to a direct fetch.
 */
export function makeSend(env: Env): Send {
    const relay: Fetcher | undefined = env.RELAY;
    if (!relay) return fetch;
    return async (url, init) => {
        const u = new URL(url);
        const upstreamHost = u.host;
        // Plain HTTP on :80 — the relay's nginx listens on 80, and the VPC service
        // picks the origin port from this scheme (https would dial :443 → refused).
        u.protocol = "http:";
        u.host = "relay";
        const headers = new Headers(init?.headers);
        headers.set("X-Upstream-Host", upstreamHost);

        const timeout = AbortSignal.timeout(RELAY_TIMEOUT_MS);
        const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
        try {
            return await relay.fetch(u.toString(), { ...init, headers, signal });
        } catch (err) {
            // A throw here means we never reached the exchange — the relay/tunnel
            // is down or hung. Re-label so it isn't read as a bad-credentials error.
            const reason = timeout.aborted
                ? `no response within ${RELAY_TIMEOUT_MS / 1000}s`
                : err instanceof Error ? err.message : "connection failed";
            throw new RelayError(`Relay unavailable (${reason}) — the home relay may be down.`);
        }
    };
}
