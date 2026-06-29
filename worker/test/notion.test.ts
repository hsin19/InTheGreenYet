import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { DataSourceNotFoundError } from "../utils";

import {
    createConfigDataSource,
    createSnapshots,
    createSnapshotsDataSource,
    createTransfer,
    createTransferDataSource,
    findOrCreateDatabase,
    queryConfig,
    querySnapshots,
    queryTransfers,
    searchDataSource,
    updateConfig,
    waitForDataSource,
} from "../notion";

type Reply = { status?: number; body?: unknown; };
type Handler = (url: string, method: string, init?: RequestInit) => Reply | undefined;

// The Notion SDK calls globalThis.fetch (see createClient). Intercept it and
// route by path/method so notion.ts runs against canned API responses.
function installRouter(handler: Handler) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        let url: string;
        if (typeof input === "string") url = input;
        else if (input instanceof URL) url = input.href;
        else url = (input as Request).url;

        const method = (init?.method ?? "GET").toUpperCase();
        const reply = handler(url, method, init) ?? { status: 200, body: {} };
        return new Response(JSON.stringify(reply.body ?? {}), {
            status: reply.status ?? 200,
            headers: { "content-type": "application/json" },
        });
    });
}

function dataSource(id: string, title: string, parentDatabaseId?: string) {
    return {
        object: "data_source",
        id,
        title: [{ plain_text: title }],
        ...(parentDatabaseId ? { parent: { type: "database_id", database_id: parentDatabaseId } } : {}),
    };
}

function searchBodyFilter(init?: RequestInit): string {
    try {
        return (JSON.parse(String(init?.body)) as { filter?: { value?: string; }; }).filter?.value ?? "";
    } catch {
        return "";
    }
}

const notFoundReply: Reply = {
    status: 404,
    body: { object: "error", status: 404, code: "object_not_found", message: "Not found" },
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe("searchDataSource", () => {
    it("returns the matching data source with its parent database", async () => {
        installRouter(url => url.endsWith("/v1/search") ? { body: { results: [dataSource("ds-1", "Transfer", "db-1")] } } : undefined);

        await expect(searchDataSource("tok", "Transfer")).resolves.toEqual({
            id: "ds-1",
            title: "Transfer",
            parentDatabaseId: "db-1",
        });
    });

    it("ignores results without a matching title and returns null", async () => {
        installRouter(url => url.endsWith("/v1/search") ? { body: { results: [dataSource("x", "Other"), { object: "data_source", id: "y" }] } } : undefined);

        await expect(searchDataSource("tok", "Transfer")).resolves.toBeNull();
    });
});

describe("queryTransfers", () => {
    it("resolves the data source then maps and paginates pages", async () => {
        let queries = 0;
        installRouter((url, method) => {
            if (url.endsWith("/v1/search")) return { body: { results: [dataSource("ds-t", "Transfer")] } };
            if (url.includes("/v1/data_sources/ds-t/query") && method === "POST") {
                queries += 1;
                if (queries === 1) {
                    return {
                        body: {
                            has_more: true,
                            next_cursor: "c1",
                            results: [{
                                object: "page",
                                id: "p1",
                                properties: {
                                    "Title": { title: [{ plain_text: "Salary" }] },
                                    "Amount": { number: 100 },
                                    "Currency": { rich_text: [{ plain_text: "USD" }] },
                                    "Fee": { number: 1 },
                                    "Exchange Rate": { number: 31 },
                                    "Date": { date: { start: "2026-06-01" } },
                                    "From": { rich_text: [{ plain_text: "bank" }] },
                                    "To": { rich_text: [{ plain_text: "cash" }] },
                                    "Note": { rich_text: [{ plain_text: "n" }] },
                                },
                            }],
                        },
                    };
                }
                return { body: { has_more: false, results: [{ object: "page", id: "p2", properties: {} }] } };
            }
            return undefined;
        });

        const rows = await queryTransfers("tok");
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({ id: "p1", title: "Salary", amount: 100, currency: "USD", from: "bank", to: "cash" });
        expect(rows[1]).toMatchObject({ id: "p2", title: "", amount: null });
    });

    it("maps a 404 from the query to DataSourceNotFoundError", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        installRouter((url, method) => {
            if (url.endsWith("/v1/search")) return { body: { results: [dataSource("ds-t", "Transfer")] } };
            if (url.includes("/v1/data_sources/ds-t/query") && method === "POST") return notFoundReply;
            return undefined;
        });

        await expect(queryTransfers("tok")).rejects.toBeInstanceOf(DataSourceNotFoundError);
    });
});

describe("queryConfig", () => {
    it("parses JSON values and falls back to raw text", async () => {
        installRouter((url, method) => {
            if (url.endsWith("/v1/search")) return { body: { results: [dataSource("ds-c", "Config")] } };
            if (url.includes("/v1/data_sources/ds-c/query") && method === "POST") {
                return {
                    body: {
                        results: [
                            { object: "page", id: "c1", properties: { Key: { title: [{ plain_text: "currencies" }] }, Value: { rich_text: [{ plain_text: '["USD"]' }] } } },
                            { object: "page", id: "c2", properties: { Key: { title: [{ plain_text: "raw" }] }, Value: { rich_text: [{ plain_text: "not-json" }] } } },
                        ],
                    },
                };
            }
            return undefined;
        });

        const rows = await queryConfig("tok", "currencies");
        expect(rows).toEqual([
            { key: "currencies", value: ["USD"] },
            { key: "raw", value: "not-json" },
        ]);
    });
});

describe("updateConfig", () => {
    it("updates an existing config row", async () => {
        const calls: string[] = [];
        installRouter((url, method) => {
            if (url.includes("/v1/data_sources/ds-c/query")) {
                return { body: { results: [{ object: "page", id: "existing", properties: {} }] } };
            }
            if (url.includes("/v1/pages/existing") && method === "PATCH") {
                calls.push("update");
                return { body: { id: "existing" } };
            }
            return undefined;
        });

        await updateConfig("tok", "baseCurrency", "USD", { dataSourceId: "ds-c" });
        expect(calls).toContain("update");
    });

    it("creates the config row when none exists", async () => {
        const calls: string[] = [];
        installRouter((url, method) => {
            if (url.includes("/v1/data_sources/ds-c/query")) return { body: { results: [] } };
            if (url.endsWith("/v1/pages") && method === "POST") {
                calls.push("create");
                return { body: { id: "new" } };
            }
            return undefined;
        });

        await updateConfig("tok", "baseCurrency", "USD", { dataSourceId: "ds-c" });
        expect(calls).toContain("create");
    });
});

describe("createTransfer", () => {
    it("resolves the data source and creates a page", async () => {
        installRouter((url, method) => {
            if (url.endsWith("/v1/search")) return { body: { results: [dataSource("ds-t", "Transfer")] } };
            if (url.endsWith("/v1/pages") && method === "POST") return { body: { id: "created" } };
            return undefined;
        });

        await expect(createTransfer("tok", {
            title: "t",
            amount: 5,
            currency: "USD",
            fee: 0,
            exchangeRate: 1,
            date: "2026-06-01",
            from: "a",
            to: "b",
            note: "",
        })).resolves.toBe("created");
    });
});

describe("snapshots", () => {
    it("creates a snapshot page per input", async () => {
        let created = 0;
        installRouter((url, method) => {
            if (url.endsWith("/v1/search")) return { body: { results: [dataSource("ds-s", "Snapshots")] } };
            if (url.endsWith("/v1/pages") && method === "POST") {
                created += 1;
                return { body: { id: `snap-${created}` } };
            }
            return undefined;
        });

        const ids = await createSnapshots("tok", [
            { account: "a", date: "2026-06-01", amount: 1, currency: "USD" },
            { account: "b", date: "2026-06-02", amount: 2, currency: "USD" },
        ]);
        expect(ids).toEqual(["snap-1", "snap-2"]);
    });

    it("queries and maps snapshot rows", async () => {
        installRouter((url, method) => {
            if (url.endsWith("/v1/search")) return { body: { results: [dataSource("ds-s", "Snapshots")] } };
            if (url.includes("/v1/data_sources/ds-s/query") && method === "POST") {
                return {
                    body: {
                        results: [{
                            object: "page",
                            id: "s1",
                            properties: {
                                Account: { title: [{ plain_text: "Bank" }] },
                                Amount: { number: 500 },
                                Currency: { rich_text: [{ plain_text: "TWD" }] },
                                Date: { date: { start: "2026-06-01" } },
                            },
                        }],
                    },
                };
            }
            return undefined;
        });

        const rows = await querySnapshots("tok");
        expect(rows).toEqual([{ id: "s1", account: "Bank", amount: 500, currency: "TWD", date: "2026-06-01" }]);
    });
});

describe("database & data source provisioning", () => {
    it("reuses the existing parent database from a surviving data source (no second DB on partial re-init)", async () => {
        // Guards the split-database bug: searching for a data source titled like the
        // DATABASE never matches (data sources are Transfer/Config/Snapshots), so a
        // partial re-init must recover the parent from a survivor — never create a
        // second database. Here a surviving "Transfer" yields its parent, no DB create.
        let createdDatabase = false;
        installRouter((url, method) => {
            if (url.endsWith("/v1/search")) return { body: { results: [dataSource("ds-t", "Transfer", "db-existing")] } };
            if (url.endsWith("/v1/databases") && method === "POST") {
                createdDatabase = true;
                return { body: { id: "db-new" } };
            }
            return undefined;
        });

        await expect(findOrCreateDatabase("tok")).resolves.toBe("db-existing");
        expect(createdDatabase).toBe(false);
    });

    it("creates the database under a shared page when none exists", async () => {
        installRouter((url, method, init) => {
            if (url.endsWith("/v1/search")) {
                // First search (data_source) misses; second (page) finds a parent.
                if (searchBodyFilter(init) === "page") {
                    return { body: { results: [{ object: "page", id: "page-1", properties: { Name: { title: [{ plain_text: "InTheGreenYet" }] } } }] } };
                }
                return { body: { results: [] } };
            }
            if (url.endsWith("/v1/databases") && method === "POST") return { body: { id: "db-new" } };
            return undefined;
        });

        await expect(findOrCreateDatabase("tok")).resolves.toBe("db-new");
    });

    it("creates the Transfer and Snapshots data sources", async () => {
        installRouter((url, method) => {
            if (url.endsWith("/v1/data_sources") && method === "POST") return { body: { id: "ds-created" } };
            return undefined;
        });

        await expect(createTransferDataSource("tok", "db-1")).resolves.toEqual({ databaseId: "db-1", dataSourceId: "ds-created" });
        await expect(createSnapshotsDataSource("tok", "db-1")).resolves.toBe("ds-created");
    });

    it("creates the Config data source and seeds defaults", async () => {
        installRouter((url, method) => {
            if (url.endsWith("/v1/data_sources") && method === "POST") return { body: { id: "cfg-ds" } };
            if (url.includes("/v1/data_sources/cfg-ds/query")) return { body: { results: [] } };
            if (url.endsWith("/v1/pages") && method === "POST") return { body: { id: "seed" } };
            return undefined;
        });

        await expect(createConfigDataSource("tok", "db-1")).resolves.toBe("cfg-ds");
    });

    it("waitForDataSource returns the id once searchable", async () => {
        installRouter(url => url.endsWith("/v1/search") ? { body: { results: [dataSource("ds-w", "Transfer")] } } : undefined);

        await expect(waitForDataSource("tok", "Transfer")).resolves.toBe("ds-w");
    });
});
