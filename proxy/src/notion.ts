const NOTION_API_VERSION = "2025-09-03";
const NOTION_BASE_URL = "https://api.notion.com/v1";

// ─── Low-level Notion API fetch ───────────────────────────────

async function notionFetch(
    path: string,
    token: string,
    options: RequestInit = {},
): Promise<Response> {
    const url = `${NOTION_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_API_VERSION,
        ...((options.headers as Record<string, string>) ?? {}),
    };

    return fetch(url, {
        ...options,
        headers,
    });
}

// ─── Search for a data source by title ────────────────────────

export async function searchDataSource(
    token: string,
    title: string,
): Promise<{ id: string; title: string } | null> {
    const res = await notionFetch("/search", token, {
        method: "POST",
        body: JSON.stringify({
            query: title,
            filter: { property: "object", value: "data_source" },
        }),
    });

    if (!res.ok) {
        throw new Error(`Search failed: ${res.status}`);
    }

    const data = (await res.json()) as {
        results: Array<{
            id: string;
            object: string;
            title: Array<{ plain_text: string }>;
        }>;
    };

    const match = data.results.find((item) =>
        item.title?.some((t) => t.plain_text === title),
    );

    return match ? { id: match.id, title } : null;
}

// ─── Find parent page ─────────────────────────────────────────
// Priority: exact match > contains > first page

async function findParentPage(token: string, pageName: string): Promise<string> {
    const res = await notionFetch("/search", token, {
        method: "POST",
        body: JSON.stringify({
            filter: { property: "object", value: "page" },
        }),
    });

    if (!res.ok) {
        throw new Error(`Failed to find parent page: ${res.status}`);
    }

    const data = (await res.json()) as {
        results: Array<{
            id: string;
            properties?: Record<
                string,
                { title?: Array<{ plain_text: string }> }
            >;
        }>;
    };

    if (data.results.length === 0) {
        throw new Error(
            "No pages shared with integration. Please share at least one page in Notion.",
        );
    }

    const getTitle = (page: (typeof data.results)[0]): string => {
        if (!page.properties) return "";
        const titleProp = Object.values(page.properties).find((p) => p.title);
        return titleProp?.title?.map((t) => t.plain_text).join("") ?? "";
    };

    const exact = data.results.find((p) => getTitle(p) === pageName);
    const partial = data.results.find((p) => getTitle(p).includes(pageName));
    return (exact ?? partial ?? data.results[0]).id;
}

// ─── Create empty database container ──────────────────────────

async function createDatabase(
    token: string,
    parentPageId: string,
    title: string,
): Promise<string> {
    const res = await notionFetch("/databases", token, {
        method: "POST",
        body: JSON.stringify({
            parent: { type: "page_id", page_id: parentPageId },
            title: [{ type: "text", text: { content: title } }],
        }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(
            `Failed to create database: ${res.status} ${errBody}`,
        );
    }

    const db = (await res.json()) as { id: string };
    return db.id;
}

// ─── Create data source with schema ───────────────────────────

async function createDataSourceInternal(
    token: string,
    databaseId: string,
    title: string,
    properties: Record<string, unknown>,
): Promise<string> {
    const res = await notionFetch("/data_sources", token, {
        method: "POST",
        body: JSON.stringify({
            parent: { database_id: databaseId },
            title: [{ type: "text", text: { content: title } }],
            properties,
        }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(
            `Failed to create data source: ${res.status} ${errBody}`,
        );
    }

    const ds = (await res.json()) as { id: string };
    return ds.id;
}

// ─── Transaction schema ───────────────────────────────────────

const PAGE_NAME = "InTheGreenYet";
const DATABASE_NAME = "InTheGreenYet DB";
const DATASOURCE_NAME = "Transaction";

const TRANSACTION_PROPERTIES = {
    Title: { title: {} },
    Amount: { number: { format: "number" } },
    Fee: { number: { format: "number" } },
    Currency: {
        select: {
            options: [
                { name: "TWD", color: "green" },
                { name: "USD", color: "blue" },
                { name: "JPY", color: "red" },
                { name: "USDT", color: "yellow" },
                { name: "USDC", color: "purple" },
            ],
        },
    },
    "Exchange Rate": { number: { format: "number" } },
    From: { rich_text: {} },
    To: { rich_text: {} },
    Date: { date: {} },
    Note: { rich_text: {} },
} as const;

// ─── Orchestrator: find/create DB → create data source ───────

export async function createTransactionDataSource(
    token: string,
): Promise<{ databaseId: string; dataSourceId: string }> {
    // Try to find existing database first
    const existingDb = await searchDataSource(token, DATABASE_NAME);
    let databaseId = existingDb?.id ?? null;

    if (!databaseId) {
        const parentPageId = await findParentPage(token, PAGE_NAME);
        databaseId = await createDatabase(token, parentPageId, DATABASE_NAME);
    }

    const dataSourceId = await createDataSourceInternal(
        token,
        databaseId,
        DATASOURCE_NAME,
        TRANSACTION_PROPERTIES,
    );
    return { databaseId, dataSourceId };
}
