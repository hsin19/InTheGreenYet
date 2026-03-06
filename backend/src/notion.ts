import { Client } from "@notionhq/client";

// ─── Constants ───────────────────────────────────────────────

const PARENT_PAGE_NAME = "InTheGreenYet";
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

const CONFIG_DATASOURCE_NAME = "Config";

const CONFIG_PROPERTIES = {
    Key: { title: {} },
    Value: { rich_text: {} },
} as const;

const CONFIG_DEFAULTS: Record<string, unknown> = {
    accounts: [],
};

// ─── Types ───────────────────────────────────────────────────

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

export interface NotionConfigRow {
    key: string;
    value: unknown;
}

// ─── Functions ───────────────────────────────────────────────

/** Search for a data source by exact title match. */
export async function searchDataSource(
    token: string,
    title: string,
): Promise<{ id: string; title: string; } | null> {
    const notion = new Client({ auth: token });

    const response = await notion.search({
        query: title,
        filter: { property: "object", value: "data_source" },
    });

    const match = response.results.find(item => {
        if (!("title" in item)) return false;
        const titles = item.title as Array<{ plain_text: string; }>;
        return titles?.some(t => t.plain_text === title);
    });

    return match ? { id: match.id, title } : null;
}

/** Query all transfer rows from a data source, sorted by date descending. */
export async function queryTransfers(
    token: string,
    dataSourceId: string,
): Promise<NotionTransferRow[]> {
    const notion = new Client({ auth: token });
    const rows: NotionTransferRow[] = [];
    let cursor: string | undefined;

    do {
        const response = await notion.dataSources.query({
            data_source_id: dataSourceId,
            sorts: [{ property: "Date", direction: "descending" }],
            ...(cursor ? { start_cursor: cursor } : {}),
        });

        for (const item of response.results) {
            if (item.object !== "page" || !("properties" in item)) continue;
            const props = item.properties as Record<string, any>;
            rows.push({
                id: item.id,
                title: props["Title"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
                amount: props["Amount"]?.number ?? null,
                currency: props["Currency"]?.select?.name ?? null,
                fee: props["Fee"]?.number ?? null,
                exchangeRate: props["Exchange Rate"]?.number ?? null,
                date: props["Date"]?.date?.start ?? null,
                from: props["From"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
                to: props["To"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
                note: props["Note"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
            });
        }

        cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);

    return rows;
}

/**
 * Find a parent page by name. Priority: exact match > contains > first page.
 * Throws if no pages are shared with the integration.
 */
async function findParentPage(token: string, pageName: string): Promise<string> {
    const notion = new Client({ auth: token });

    const response = await notion.search({
        filter: { property: "object", value: "page" },
    });

    if (response.results.length === 0) {
        throw new Error(
            "No pages shared with integration. Please share at least one page in Notion.",
        );
    }

    const getTitle = (page: any): string => {
        if (!page.properties) return "";
        const titleProp = Object.values(page.properties).find((p: any) => p.title);
        return (titleProp as any)?.title?.map((t: any) => t.plain_text).join("") ?? "";
    };

    const exact = response.results.find(p => getTitle(p) === pageName);
    const partial = response.results.find(p => getTitle(p).includes(pageName));
    return (exact ?? partial ?? response.results[0]).id;
}

/** Create an empty database under a parent page. */
async function createDatabase(
    token: string,
    parentPageId: string,
    title: string,
): Promise<string> {
    const notion = new Client({ auth: token });

    const response = await notion.databases.create({
        parent: { type: "page_id", page_id: parentPageId },
        title: [{ type: "text", text: { content: title } }],
    });

    return response.id;
}

/** Create a data source with the given property schema inside a database. */
async function createDataSourceInternal(
    token: string,
    databaseId: string,
    title: string,
    properties: Record<string, unknown>,
): Promise<string> {
    const notion = new Client({ auth: token });

    const response = await notion.dataSources.create({
        parent: { database_id: databaseId },
        title: [{ type: "text", text: { content: title } }],
        properties: properties as any,
    });

    return response.id;
}

/** Create a transfer page in the given data source. */
export async function createTransfer(
    token: string,
    dataSourceId: string,
    input: CreateTransferInput,
): Promise<string> {
    const notion = new Client({ auth: token });

    const properties: Record<string, unknown> = {
        Title: { title: [{ text: { content: input.title } }] },
        From: { rich_text: [{ text: { content: input.from } }] },
        To: { rich_text: [{ text: { content: input.to } }] },
        Note: { rich_text: [{ text: { content: input.note } }] },
    };

    if (input.amount != null) properties["Amount"] = { number: input.amount };
    if (input.currency) properties["Currency"] = { select: { name: input.currency } };
    if (input.fee != null) properties["Fee"] = { number: input.fee };
    if (input.exchangeRate != null) properties["Exchange Rate"] = { number: input.exchangeRate };
    if (input.date) properties["Date"] = { date: { start: input.date } };

    const response = await notion.pages.create({
        parent: { type: "data_source_id", data_source_id: dataSourceId } as any,
        properties: properties as any,
    });

    return response.id;
}

/** Find or create the application database. */
async function findOrCreateDatabase(token: string): Promise<string> {
    const existingDb = await searchDataSource(token, DATABASE_NAME);
    if (existingDb) return existingDb.id;
    const parentPageId = await findParentPage(token, PARENT_PAGE_NAME);
    return createDatabase(token, parentPageId, DATABASE_NAME);
}

/** Create the Transfer data source with its schema inside the app database. */
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

/** Create the Config data source and seed it with default key-value pairs. */
export async function createConfigDataSource(token: string): Promise<string> {
    const notion = new Client({ auth: token });
    const databaseId = await findOrCreateDatabase(token);
    const dataSourceId = await createDataSourceInternal(
        token,
        databaseId,
        CONFIG_DATASOURCE_NAME,
        CONFIG_PROPERTIES,
    );
    await Promise.all(
        Object.entries(CONFIG_DEFAULTS).map(([key, value]) =>
            notion.pages.create({
                parent: { type: "data_source_id", data_source_id: dataSourceId } as any,
                properties: {
                    Key: { title: [{ text: { content: key } }] } as any,
                    Value: { rich_text: [{ text: { content: JSON.stringify(value) } }] } as any,
                },
            })
        ),
    );
    return dataSourceId;
}

/** Query config rows from a data source, optionally filtered by key. */
export async function queryConfig(
    token: string,
    dataSourceId: string,
    key?: string,
): Promise<NotionConfigRow[]> {
    const notion = new Client({ auth: token });

    const response = await notion.dataSources.query({
        data_source_id: dataSourceId,
        ...(key ? { filter: { property: "Key", title: { equals: key } } } : {}),
    });

    return response.results
        .filter(item => item.object === "page" && "properties" in item)
        .map(item => {
            const props = (item as any).properties;
            const rawValue = props["Value"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "null";
            let value: unknown;
            try {
                value = JSON.parse(rawValue);
            } catch {
                value = rawValue;
            }
            return {
                key: props["Key"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
                value,
            };
        });
}
