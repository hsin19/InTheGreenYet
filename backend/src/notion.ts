/* eslint-disable @typescript-eslint/no-explicit-any */

import { Client } from "@notionhq/client";
import {
    APIResponseError,
    isNotionClientError,
} from "@notionhq/client";
import { DataSourceNotFoundError } from "./utils";

export function createClient(token?: string): Client {
    return new Client({ ...(token ? { auth: token } : {}), fetch: globalThis.fetch.bind(globalThis) });
}

// ─── Constants ───────────────────────────────────────────────

const PARENT_PAGE_NAME = "InTheGreenYet";
const DATABASE_NAME = "InTheGreenYet DB";
const DATASOURCE_NAME = "Transfer";

const TRANSFER_PROPERTIES = {
    "Title": { title: {} },
    "Amount": { number: { format: "number" } },
    "Fee": { number: { format: "number" } },
    "Currency": { rich_text: {} },
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
    accounts: {
        Bank: { displayName: "Bank", currency: "TWD", isInvestment: false, accountType: "bank" },
        Binance: { displayName: "Binance", currency: "USDT", isInvestment: true, accountType: "binance" },
        OKX: { displayName: "OKX", currency: "USDT", isInvestment: true, accountType: "okx" },
        Bitget: { displayName: "Bitget", currency: "USDT", isInvestment: true, accountType: "bitget" },
        MAX: { displayName: "MAX", currency: "TWD", isInvestment: true, accountType: "max" },
    },
    currencies: ["TWD", "USD", "USDT"],
};

const SNAPSHOTS_DATASOURCE_NAME = "Snapshots";

const SNAPSHOTS_PROPERTIES = {
    Account: { title: {} },
    Date: { date: {} },
    Amount: { number: { format: "number" } },
    Currency: { rich_text: {} },
} as const;

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

export interface NotionSnapshotRow {
    id: string;
    account: string;
    date: string | null;
    amount: number | null;
    currency: string | null;
}

export interface CreateSnapshotInput {
    account: string;
    date: string;
    amount: number;
    currency: string;
}

// ─── Functions ───────────────────────────────────────────────

/** Resolve a data source ID by name; retries for Notion index delay. */
async function resolveDataSource(token: string, name: string): Promise<string> {
    const existing = await searchDataSource(token, name, { retries: 3 });
    if (existing) return existing.id;
    throw new DataSourceNotFoundError(name);
}

/** Wrap a Notion API call; convert 404 object_not_found to DataSourceNotFoundError. */
async function notionCall<T>(name: string, fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        if (isNotionClientError(err) && err instanceof APIResponseError && err.status === 404) {
            console.error(`Notion API returned 404 for data source "${name}". This may be due to Notion's eventual consistency after creating a data source. Retries should be attempted.`, err);

            throw new DataSourceNotFoundError(name);
        }
        throw err;
    }
}

/** Search for a data source by exact title match, with retry for Notion index delay. */
export async function searchDataSource(
    token: string,
    title: string,
    { retries = 0, delay = 2000 }: { retries?: number; delay?: number; } = {},
): Promise<{ id: string; title: string; parentDatabaseId?: string; } | null> {
    const notion = createClient(token);

    for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, delay));

        const response = await notion.search({
            query: title,
            filter: { property: "object", value: "data_source" },
        });

        const match = response.results.find(item => {
            if (!("title" in item)) return false;
            const titles = item.title as Array<{ plain_text: string; }>;
            return titles?.some(t => t.plain_text === title);
        });

        if (match) {
            const parentDatabaseId = (match as any).parent?.type === "database_id"
                ? (match as any).parent.database_id
                : undefined;
            return { id: match.id, title, parentDatabaseId };
        }
    }

    return null;
}

/** Query all transfer rows, sorted by date descending. */
export async function queryTransfers(token: string): Promise<NotionTransferRow[]> {
    const notion = createClient(token);
    const dataSourceId = await resolveDataSource(token, DATASOURCE_NAME);
    const rows: NotionTransferRow[] = [];
    let cursor: string | undefined;

    do {
        const response = await notionCall(DATASOURCE_NAME, () =>
            notion.dataSources.query({
                data_source_id: dataSourceId,
                sorts: [{ property: "Date", direction: "descending" }],
                ...(cursor ? { start_cursor: cursor } : {}),
            }));

        for (const item of response.results) {
            if (item.object !== "page" || !("properties" in item)) continue;
            const props = item.properties as Record<string, any>;
            rows.push({
                id: item.id,
                title: props["Title"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
                amount: props["Amount"]?.number ?? null,
                currency: props["Currency"]?.rich_text?.map((t: any) => t.plain_text).join("") || null,
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
    const notion = createClient(token);

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
    const notion = createClient(token);

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
    const notion = createClient(token);

    const response = await notion.dataSources.create({
        parent: { type: "database_id", database_id: databaseId },
        title: [{ type: "text", text: { content: title } }],
        properties: properties as any,
    });

    return response.id;
}

/** Create a transfer page in the Transfer data source. */
export async function createTransfer(
    token: string,
    input: CreateTransferInput,
): Promise<string> {
    const notion = createClient(token);
    const dataSourceId = await resolveDataSource(token, DATASOURCE_NAME);

    const properties: Record<string, unknown> = {
        Title: { title: [{ text: { content: input.title } }] },
        From: { rich_text: [{ text: { content: input.from } }] },
        To: { rich_text: [{ text: { content: input.to } }] },
        Note: { rich_text: [{ text: { content: input.note } }] },
    };

    if (input.amount != null) properties["Amount"] = { number: input.amount };
    if (input.currency) properties["Currency"] = { rich_text: [{ text: { content: input.currency } }] };
    if (input.fee != null) properties["Fee"] = { number: input.fee };
    if (input.exchangeRate != null) properties["Exchange Rate"] = { number: input.exchangeRate };
    if (input.date) properties["Date"] = { date: { start: input.date } };

    const response = await notionCall(DATASOURCE_NAME, () =>
        notion.pages.create({
            parent: { type: "data_source_id", data_source_id: dataSourceId } as any,
            properties: properties as any,
        }));

    return response.id;
}

/** Find or create the application database. If existing, returns the actual parent database ID. */
export async function findOrCreateDatabase(token: string): Promise<string> {
    const existingDb = await searchDataSource(token, DATABASE_NAME);

    // In the new Notion API, Data Sources belong to a parent Database.
    // If we found an existing data source, we must use its parent database ID
    // for creating other sibling data sources.
    if (existingDb && existingDb.parentDatabaseId) {
        return existingDb.parentDatabaseId;
    }

    const parentPageId = await findParentPage(token, PARENT_PAGE_NAME);
    return createDatabase(token, parentPageId, DATABASE_NAME);
}

/** Create the Transfer data source with its schema inside the app database. */
export async function createTransferDataSource(
    token: string,
    databaseId: string,
): Promise<{ databaseId: string; dataSourceId: string; }> {
    const dataSourceId = await createDataSourceInternal(
        token,
        databaseId,
        DATASOURCE_NAME,
        TRANSFER_PROPERTIES,
    );
    return { databaseId, dataSourceId };
}

/** Create the Config data source. */
export async function createConfigDataSource(
    token: string,
    databaseId: string,
): Promise<string> {
    const dataSourceId = await createDataSourceInternal(
        token,
        databaseId,
        CONFIG_DATASOURCE_NAME,
        CONFIG_PROPERTIES,
    );

    await updateConfig(token, "currencies", CONFIG_DEFAULTS.currencies, { dataSourceId });
    await updateConfig(token, "accounts", CONFIG_DEFAULTS.accounts, { dataSourceId });
    return dataSourceId;
}

/** Create the Snapshots data source. */
export async function createSnapshotsDataSource(
    token: string,
    databaseId: string,
): Promise<string> {
    return createDataSourceInternal(
        token,
        databaseId,
        SNAPSHOTS_DATASOURCE_NAME,
        SNAPSHOTS_PROPERTIES,
    );
}

/** Query config rows, optionally filtered by key. */
export async function queryConfig(
    token: string,
    key?: string,
): Promise<NotionConfigRow[]> {
    const notion = createClient(token);
    const dataSourceId = await resolveDataSource(token, CONFIG_DATASOURCE_NAME);

    const response = await notionCall(CONFIG_DATASOURCE_NAME, () =>
        notion.dataSources.query({
            data_source_id: dataSourceId,
            ...(key ? { filter: { property: "Key", title: { equals: key } } } : {}),
        }));

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

/** Upsert a config row by key. Updates if exists, creates if not. */
export async function updateConfig(
    token: string,
    key: string,
    value: unknown,
    { dataSourceId: explicitId }: { dataSourceId?: string; } = {},
): Promise<void> {
    const notion = createClient(token);
    const dataSourceId = explicitId ?? await resolveDataSource(token, CONFIG_DATASOURCE_NAME);
    const serialized = JSON.stringify(value);
    const valueProperty = { rich_text: [{ text: { content: serialized } }] } as any;

    const response = await notionCall(CONFIG_DATASOURCE_NAME, () =>
        notion.dataSources.query({
            data_source_id: dataSourceId,
            filter: { property: "Key", title: { equals: key } },
        }));

    const existing = response.results.find(item => item.object === "page" && "properties" in item);

    if (existing) {
        await notionCall(CONFIG_DATASOURCE_NAME, () =>
            notion.pages.update({
                page_id: existing.id,
                properties: { Value: valueProperty },
            }));
    } else {
        await notionCall(CONFIG_DATASOURCE_NAME, () =>
            notion.pages.create({
                parent: { type: "data_source_id", data_source_id: dataSourceId } as any,
                properties: {
                    Key: { title: [{ text: { content: key } }] } as any,
                    Value: valueProperty,
                },
            }));
    }
}

/** Query all snapshot rows, sorted by date descending. */
export async function querySnapshots(token: string): Promise<NotionSnapshotRow[]> {
    const notion = createClient(token);
    const dataSourceId = await resolveDataSource(token, SNAPSHOTS_DATASOURCE_NAME);
    const rows: NotionSnapshotRow[] = [];
    let cursor: string | undefined;

    do {
        const response = await notionCall(SNAPSHOTS_DATASOURCE_NAME, () =>
            notion.dataSources.query({
                data_source_id: dataSourceId,
                sorts: [{ property: "Date", direction: "descending" }],
                ...(cursor ? { start_cursor: cursor } : {}),
            }));

        for (const item of response.results) {
            if (item.object !== "page" || !("properties" in item)) continue;
            const props = item.properties as Record<string, any>;
            rows.push({
                id: item.id,
                account: props["Account"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
                amount: props["Amount"]?.number ?? null,
                currency: props["Currency"]?.rich_text?.map((t: any) => t.plain_text).join("") || null,
                date: props["Date"]?.date?.start ?? null,
            });
        }

        cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);

    return rows;
}

/** Create snapshot pages in the Snapshots data source. */
export async function createSnapshots(
    token: string,
    inputs: CreateSnapshotInput[],
): Promise<string[]> {
    const notion = createClient(token);
    const dataSourceId = await resolveDataSource(token, SNAPSHOTS_DATASOURCE_NAME);
    const createdIds: string[] = [];

    for (const input of inputs) {
        const properties: Record<string, unknown> = {
            Account: { title: [{ text: { content: input.account } }] },
            Date: { date: { start: input.date } },
            Amount: { number: input.amount },
            Currency: { rich_text: [{ text: { content: input.currency } }] },
        };

        const response = await notionCall(SNAPSHOTS_DATASOURCE_NAME, () =>
            notion.pages.create({
                parent: { type: "data_source_id", data_source_id: dataSourceId } as any,
                properties: properties as any,
            }));

        createdIds.push(response.id);
    }

    return createdIds;
}
