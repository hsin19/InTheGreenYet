import type {
    ConfigRow,
    CreateTransferInput,
    Transfer,
} from "@shared/model";
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { DataSourceNotFoundError } from "./api";
import {
    createDataStore,
    disposeWorkspaceData,
    IdbStore,
    NotionStore,
    ReadOnlyStore,
    SwrStore,
} from "./datastore";

const INPUT: CreateTransferInput = {
    title: "Salary",
    amount: 1000,
    currency: "USD",
    fee: 0,
    exchangeRate: null,
    date: "2026-06-01",
    from: "bank",
    to: "cash",
    note: "",
};

function mockFetch(body: unknown, status = 200): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(body), { status }),
    );
}

// A fresh namespace per test keeps the real IndexedDB stores isolated.
let nsCounter = 0;
function freshNamespace(): string {
    nsCounter += 1;
    return `test-${nsCounter}-${performance.now().toString(36)}`;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("NotionStore", () => {
    it("reads transfers, config and reports no local sync time", async () => {
        const store = new NotionStore("tok");

        mockFetch({ transfers: [{ id: "1", ...INPUT }] });
        await expect(store.getTransfers()).resolves.toEqual([{ id: "1", ...INPUT }]);

        vi.restoreAllMocks();
        mockFetch({ config: [{ key: "baseCurrency", value: "USD" }] });
        await expect(store.getConfig()).resolves.toEqual([{ key: "baseCurrency", value: "USD" }]);

        await expect(store.getLastSyncedAt()).resolves.toBeNull();
        await expect(store.revalidate()).resolves.toBeUndefined();
    });

    it("posts a new transfer and returns it with the server id", async () => {
        const store = new NotionStore("tok");
        const spy = mockFetch({ id: "srv-1" });

        await expect(store.addTransfer(INPUT)).resolves.toEqual({ id: "srv-1", ...INPUT });

        const [url, init] = spy.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("/api/transfers");
        expect(init.method).toBe("POST");
    });

    it("saves config, posts snapshots and provisions data sources", async () => {
        const store = new NotionStore("tok");

        const saveSpy = mockFetch({ ok: true });
        await store.saveConfig("baseCurrency", "TWD");
        expect((saveSpy.mock.calls[0][1] as RequestInit).method).toBe("PUT");

        vi.restoreAllMocks();
        const snapSpy = mockFetch({ success: true });
        await store.addSnapshots([{ account: "a", date: "2026-06-01", amount: 1, currency: "USD" }]);
        expect(snapSpy.mock.calls[0][0] as string).toContain("/api/snapshots");

        vi.restoreAllMocks();
        const initSpy = mockFetch({ ok: true });
        await store.init();
        expect(initSpy.mock.calls[0][0] as string).toContain("/api/init");
    });
});

describe("IdbStore", () => {
    it("round-trips a transfer without leaking the cache metadata", async () => {
        const store = new IdbStore(freshNamespace());

        const row = await store.addTransfer(INPUT);
        expect(row.id).toBeTruthy();

        const all = await store.getTransfers();
        expect(all).toEqual([row]);
        expect(all[0]).not.toHaveProperty("_updatedAt");
    });

    it("stores config and meta, and starts with no sync time", async () => {
        const store = new IdbStore(freshNamespace());

        await expect(store.getLastSyncedAt()).resolves.toBeNull();

        await store.saveConfig("baseCurrency", "USD");
        await expect(store.getConfig()).resolves.toEqual([{ key: "baseCurrency", value: "USD" }]);

        await store.setMeta("lastSyncedAt", 1234);
        await expect(store.getLastSyncedAt()).resolves.toBe(1234);
    });

    it("replaces cached transfers and config wholesale", async () => {
        const store = new IdbStore(freshNamespace());

        await store.addTransfer(INPUT);
        const replacement: Transfer[] = [{ id: "x", ...INPUT, title: "Bonus" }];
        await store.replaceTransfers(replacement);
        await expect(store.getTransfers()).resolves.toEqual(replacement);

        const config: ConfigRow[] = [{ key: "currencies", value: ["USD", "TWD"] }];
        await store.replaceConfig(config);
        await expect(store.getConfig()).resolves.toEqual(config);
    });

    it("puts a single transfer and no-ops snapshots/revalidate", async () => {
        const store = new IdbStore(freshNamespace());

        await store.putTransfer({ id: "p", ...INPUT });
        await expect(store.getTransfers()).resolves.toEqual([{ id: "p", ...INPUT }]);

        await expect(store.addSnapshots([])).resolves.toBeUndefined();
        await expect(store.revalidate()).resolves.toBeUndefined();
    });
});

describe("SwrStore", () => {
    function makeSwr() {
        const cache = new IdbStore(freshNamespace());
        const remote = new NotionStore("tok");
        return { store: new SwrStore(cache, remote), cache, remote };
    }

    it("reads through the cache", async () => {
        const { store, cache } = makeSwr();
        await cache.putTransfer({ id: "c", ...INPUT });

        await expect(store.getTransfers()).resolves.toEqual([{ id: "c", ...INPUT }]);
        await expect(store.getConfig()).resolves.toEqual([]);
        await expect(store.getLastSyncedAt()).resolves.toBeNull();
    });

    it("revalidate syncs remote data into the cache", async () => {
        const { store, remote, cache } = makeSwr();
        vi.spyOn(remote, "getTransfers").mockResolvedValue([{ id: "r", ...INPUT }]);
        vi.spyOn(remote, "getConfig").mockResolvedValue([{ key: "baseCurrency", value: "USD" }]);

        await store.revalidate();

        await expect(cache.getTransfers()).resolves.toEqual([{ id: "r", ...INPUT }]);
        await expect(cache.getConfig()).resolves.toEqual([{ key: "baseCurrency", value: "USD" }]);
        await expect(cache.getLastSyncedAt()).resolves.toEqual(expect.any(Number));
    });

    it("provisions data sources once and retries on DataSourceNotFoundError", async () => {
        const { store, remote } = makeSwr();
        const init = vi.spyOn(remote, "init").mockResolvedValue();
        vi.spyOn(remote, "getConfig").mockResolvedValue([]);
        vi.spyOn(remote, "getTransfers")
            .mockRejectedValueOnce(new DataSourceNotFoundError())
            .mockResolvedValue([]);

        await store.revalidate();

        expect(init).toHaveBeenCalledTimes(1);
    });

    it("rethrows non-DataSource errors from revalidate", async () => {
        const { store, remote } = makeSwr();
        vi.spyOn(remote, "getTransfers").mockRejectedValue(new Error("boom"));
        vi.spyOn(remote, "getConfig").mockResolvedValue([]);

        await expect(store.revalidate()).rejects.toThrow("boom");
    });

    it("writes through to remote then caches", async () => {
        const { store, remote, cache } = makeSwr();
        vi.spyOn(remote, "addTransfer").mockResolvedValue({ id: "srv", ...INPUT });
        const saveConfig = vi.spyOn(remote, "saveConfig").mockResolvedValue();
        const addSnapshots = vi.spyOn(remote, "addSnapshots").mockResolvedValue();

        const row = await store.addTransfer(INPUT);
        expect(row.id).toBe("srv");
        await expect(cache.getTransfers()).resolves.toEqual([{ id: "srv", ...INPUT }]);

        await store.saveConfig("baseCurrency", "TWD");
        expect(saveConfig).toHaveBeenCalledWith("baseCurrency", "TWD");
        await expect(cache.getConfig()).resolves.toEqual([{ key: "baseCurrency", value: "TWD" }]);

        await store.addSnapshots([]);
        expect(addSnapshots).toHaveBeenCalled();
    });
});

describe("ReadOnlyStore", () => {
    it("delegates reads to the inner store", async () => {
        const inner = new IdbStore(freshNamespace());
        await inner.putTransfer({ id: "ro", ...INPUT });
        const store = new ReadOnlyStore(inner);

        expect(store.canWrite).toBe(false);
        expect(store.mode).toBe("offline");
        await expect(store.getTransfers()).resolves.toEqual([{ id: "ro", ...INPUT }]);
        await expect(store.getConfig()).resolves.toEqual([]);
        await expect(store.getLastSyncedAt()).resolves.toBeNull();
        await expect(store.revalidate()).resolves.toBeUndefined();
    });

    it("forbids every write", () => {
        const store = new ReadOnlyStore(new IdbStore(freshNamespace()));
        expect(() => store.addTransfer()).toThrow("Read-only");
        expect(() => store.saveConfig()).toThrow("Read-only");
        expect(() => store.addSnapshots()).toThrow("Read-only");
    });
});

describe("createDataStore", () => {
    it("returns an IdbStore when there is no auth", () => {
        expect(createDataStore({ auth: null })).toBeInstanceOf(IdbStore);
    });

    it("wraps the IdbStore in ReadOnlyStore when read-only and unauthenticated", () => {
        expect(createDataStore({ auth: null, readOnly: true })).toBeInstanceOf(ReadOnlyStore);
    });

    it("returns a SwrStore when authenticated", () => {
        const store = createDataStore({ auth: { access_token: "tok", workspace_id: "ws" } });
        expect(store).toBeInstanceOf(SwrStore);
        expect(store.canWrite).toBe(true);
    });

    it("wraps the SwrStore in ReadOnlyStore when read-only and authenticated", () => {
        const store = createDataStore({ auth: { access_token: "tok" }, readOnly: true });
        expect(store).toBeInstanceOf(ReadOnlyStore);
    });
});

describe("disposeWorkspaceData", () => {
    it("deletes the namespaced database without throwing", async () => {
        // Delete a namespace that has no open connections so the request can't
        // block on `versionchange` — IdbStore keeps its connections open.
        await expect(disposeWorkspaceData(freshNamespace())).resolves.toBeUndefined();
    });
});
