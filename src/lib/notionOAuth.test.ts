import {
    describe,
    expect,
    it,
} from "vitest";
import { buildNotionAuthorizeUrl } from "./notionOAuth";

describe("buildNotionAuthorizeUrl", () => {
    it("assembles the Notion authorize URL with all required params", () => {
        const url = buildNotionAuthorizeUrl(
            "client-123",
            "https://app.example.com/auth/notion/callback",
            "state-xyz",
        );
        const parsed = new URL(url);

        expect(parsed.origin + parsed.pathname).toBe("https://api.notion.com/v1/oauth/authorize");
        expect(parsed.searchParams.get("owner")).toBe("user");
        expect(parsed.searchParams.get("client_id")).toBe("client-123");
        expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.example.com/auth/notion/callback");
        expect(parsed.searchParams.get("response_type")).toBe("code");
        expect(parsed.searchParams.get("state")).toBe("state-xyz");
    });

    it("URL-encodes the redirect_uri in the query string", () => {
        const url = buildNotionAuthorizeUrl("c", "https://x.dev/auth/notion/callback", "s");
        expect(url).toContain("redirect_uri=https%3A%2F%2Fx.dev%2Fauth%2Fnotion%2Fcallback");
    });
});
