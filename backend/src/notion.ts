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
        "Authorization": `Bearer ${token}`,
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
): Promise<{ id: string; title: string; } | null> {
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
            title: Array<{ plain_text: string; }>;
        }>;
    };

    const match = data.results.find(item => item.title?.some(t => t.plain_text === title));

    return match ? { id: match.id, title } : null;
}

// ─── Query transfers from a data source ───────────────────────

export interface NotionTransferRow {
    id: string;
    title: string;
    amount: number | null;
    currency: string | null;
    fee: number | null;
    exchangeRate: number | null;
    date: string | null;
    from: string;
    to: string;
    note: string;
}

type NotionQueryResponse = {
    object: "list";
    results: Array<{
        object: string;
        id: string;
        properties: Record<string, {
            type: string;
            title?: Array<{ plain_text: string; }>;
            number?: number | null;
            select?: { name: string; } | null;
            date?: { start: string; } | null;
            rich_text?: Array<{ plain_text: string; }>;
        }>;
    }>;
    has_more: boolean;
    next_cursor: string | null;
};

export async function queryTransfers(
    token: string,
    dataSourceId: string,
): Promise<NotionTransferRow[]> {
    const rows: NotionTransferRow[] = [];
    let cursor: string | undefined;

    do {
        const body: Record<string, unknown> = {
            sorts: [{ property: "Date", direction: "descending" }],
        };
        if (cursor) body.start_cursor = cursor;

        const res = await notionFetch(`/data_sources/${dataSourceId}/query`, token, {
            method: "POST",
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            throw new Error(`Query failed: ${res.status}`);
        }

        const data = (await res.json()) as NotionQueryResponse;

        for (const item of data.results) {
            if (item.object !== "page") continue;
            const props = item.properties;
            rows.push({
                id: item.id,
                title: props["Title"]?.title?.map(t => t.plain_text).join("") ?? "",
                amount: props["Amount"]?.number ?? null,
                currency: props["Currency"]?.select?.name ?? null,
                fee: props["Fee"]?.number ?? null,
                exchangeRate: props["Exchange Rate"]?.number ?? null,
                date: props["Date"]?.date?.start ?? null,
                from: props["From"]?.rich_text?.map(t => t.plain_text).join("") ?? "",
                to: props["To"]?.rich_text?.map(t => t.plain_text).join("") ?? "",
                note: props["Note"]?.rich_text?.map(t => t.plain_text).join("") ?? "",
            });
        }

        cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
    } while (cursor);

    return rows;
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
                { title?: Array<{ plain_text: string; }>; }
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
        const titleProp = Object.values(page.properties).find(p => p.title);
        return titleProp?.title?.map(t => t.plain_text).join("") ?? "";
    };

    const exact = data.results.find(p => getTitle(p) === pageName);
    const partial = data.results.find(p => getTitle(p).includes(pageName));
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

    const db = (await res.json()) as { id: string; };
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

    const ds = (await res.json()) as { id: string; };
    return ds.id;
}

// ─── Create a transfer page ───────────────────────────────────

export interface CreateTransferInput {
    title: string;
    amount: number | null;
    currency: string | null;
    fee: number | null;
    exchangeRate: number | null;
    date: string | null;
    from: string;
    to: string;
    note: string;
}

export async function createTransfer(
    token: string,
    dataSourceId: string,
    input: CreateTransferInput,
): Promise<string> {
    const properties: Record<string, unknown> = {
        "Title": { title: [{ text: { content: input.title } }] },
        "From": { rich_text: [{ text: { content: input.from } }] },
        "To": { rich_text: [{ text: { content: input.to } }] },
        "Note": { rich_text: [{ text: { content: input.note } }] },
    };

    if (input.amount != null) properties["Amount"] = { number: input.amount };
    if (input.currency) properties["Currency"] = { select: { name: input.currency } };
    if (input.fee != null) properties["Fee"] = { number: input.fee };
    if (input.exchangeRate != null) properties["Exchange Rate"] = { number: input.exchangeRate };
    if (input.date) properties["Date"] = { date: { start: input.date } };

    const res = await notionFetch("/pages", token, {
        method: "POST",
        body: JSON.stringify({
            parent: { type: "data_source_id", data_source_id: dataSourceId },
            properties,
        }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Failed to create transfer: ${res.status} ${errBody}`);
    }

    const page = (await res.json()) as { id: string };
    return page.id;
}

// ─── Transfer schema ──────────────────────────────────────────

const PAGE_NAME = "InTheGreenYet";
const DATABASE_NAME = "InTheGreenYet DB";
const DATASOURCE_NAME = "Transfer";

const TRANSFER_PROPERTIES = {
    "Title": { title: {} },
    "Amount": { number: { format: "number" } },
    "Fee": { number: { format: "number" } },
    "Currency": {
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
    "From": { rich_text: {} },
    "To": { rich_text: {} },
    "Date": { date: {} },
    "Note": { rich_text: {} },
} as const;

// ─── Orchestrator: find/create DB → create data source ───────

async function findOrCreateDatabase(token: string): Promise<string> {
    const existingDb = await searchDataSource(token, DATABASE_NAME);
    if (existingDb) return existingDb.id;
    const parentPageId = await findParentPage(token, PAGE_NAME);
    return createDatabase(token, parentPageId, DATABASE_NAME);
}

export async function createTransferDataSource(
    token: string,
): Promise<{ databaseId: string; dataSourceId: string; }> {
    const databaseId = await findOrCreateDatabase(token);
    const dataSourceId = await createDataSourceInternal(
        token,
        databaseId,
        DATASOURCE_NAME,
        TRANSFER_PROPERTIES,
    );
    return { databaseId, dataSourceId };
}

// ─── Config data source ───────────────────────────────────────

const CONFIG_DATASOURCE_NAME = "Config";

const CONFIG_PROPERTIES = {
    "Key": { title: {} },
    "Value": { rich_text: {} },
} as const;

const CONFIG_DEFAULTS: Record<string, unknown> = {
    accounts: [],
};

export interface NotionConfigRow {
    key: string;
    value: unknown;
}

export async function createConfigDataSource(token: string): Promise<string> {
    const databaseId = await findOrCreateDatabase(token);
    const dataSourceId = await createDataSourceInternal(
        token,
        databaseId,
        CONFIG_DATASOURCE_NAME,
        CONFIG_PROPERTIES,
    );
    await Promise.all(
        Object.entries(CONFIG_DEFAULTS).map(([key, value]) =>
            notionFetch("/pages", token, {
                method: "POST",
                body: JSON.stringify({
                    parent: { type: "data_source_id", data_source_id: dataSourceId },
                    properties: {
                        "Key": { title: [{ text: { content: key } }] },
                        "Value": { rich_text: [{ text: { content: JSON.stringify(value) } }] },
                    },
                }),
            }),
        ),
    );
    return dataSourceId;
}

export async function queryConfig(
    token: string,
    dataSourceId: string,
    key?: string,
): Promise<NotionConfigRow[]> {
    const body: Record<string, unknown> = {};
    if (key) {
        body.filter = { property: "Key", title: { equals: key } };
    }

    const res = await notionFetch(`/data_sources/${dataSourceId}/query`, token, {
        method: "POST",
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Config query failed: ${res.status}`);

    const data = (await res.json()) as NotionQueryResponse;
    return data.results
        .filter(item => item.object === "page")
        .map(item => {
            const rawValue = item.properties["Value"]?.rich_text?.map(t => t.plain_text).join("") ?? "null";
            let value: unknown;
            try { value = JSON.parse(rawValue); } catch { value = rawValue; }
            return {
                key: item.properties["Key"]?.title?.map(t => t.plain_text).join("") ?? "",
                value,
            };
        });
}
