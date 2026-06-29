import {
    type DBSchema,
    deleteDB,
    openDB,
} from "idb";
import {
    apiFetch,
    DataSourceNotFoundError,
} from "./api";
import type {
    ConfigRow,
    CreateSnapshotInput,
    CreateTransferInput,
    Transfer,
} from "./model";

// ─── DataStore interface ──────────────────────────────────────

export type StoreMode = "online" | "local-only" | "offline";

export interface DataStore {
    readonly mode: StoreMode;
    readonly canWrite: boolean;

    getTransfers(): Promise<Transfer[]>;
    getConfig(): Promise<ConfigRow[]>;
    getLastSyncedAt(): Promise<number | null>;

    /** Refresh internal cache from upstream. No-op when there is no upstream. */
    revalidate(): Promise<void>;

    addTransfer(input: CreateTransferInput): Promise<Transfer>;
    saveConfig(key: string, value: unknown): Promise<void>;
    addSnapshots(snapshots: CreateSnapshotInput[]): Promise<void>;
}

// ─── IDB schema ───────────────────────────────────────────────

const DB_VERSION = 1;
const DB_PREFIX = "inthegreenyet";

// `_updatedAt` is unused in Phase 1 but reserved for Phase 2 last-write-wins.
type Cached<T> = T & { _updatedAt: number; };

interface InTheGreenSchema extends DBSchema {
    transfers: { key: string; value: Cached<Transfer>; };
    config: { key: string; value: Cached<ConfigRow>; };
    meta: { key: string; value: { key: string; value: unknown; updatedAt: number; }; };
}

function dbName(namespace: string): string {
    return `${DB_PREFIX}-${namespace || "default"}`;
}

function openIdb(namespace: string) {
    return openDB<InTheGreenSchema>(dbName(namespace), DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains("transfers")) {
                db.createObjectStore("transfers", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("config")) {
                db.createObjectStore("config", { keyPath: "key" });
            }
            if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "key" });
            }
        },
    });
}

export async function disposeWorkspaceData(namespace: string): Promise<void> {
    await deleteDB(dbName(namespace));
}

// ─── NotionStore — talks to backend only ──────────────────────

export class NotionStore implements DataStore {
    readonly mode = "online" as const;
    readonly canWrite = true;

    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    async getTransfers(): Promise<Transfer[]> {
        const data = await apiFetch<{ transfers: Transfer[]; }>("/api/transfers", this.token);
        return data.transfers;
    }

    async getConfig(): Promise<ConfigRow[]> {
        const data = await apiFetch<{ config: ConfigRow[]; }>("/api/config", this.token);
        return data.config;
    }

    async getLastSyncedAt(): Promise<number | null> {
        return null;
    }

    async revalidate(): Promise<void> {
        // Always fresh; nothing to do.
    }

    async addTransfer(input: CreateTransferInput): Promise<Transfer> {
        const data = await apiFetch<{ id: string; }>("/api/transfers", this.token, {
            method: "POST",
            body: JSON.stringify(input),
        });
        return { id: data.id, ...input };
    }

    async saveConfig(key: string, value: unknown): Promise<void> {
        await apiFetch<{ ok: boolean; }>("/api/config", this.token, {
            method: "PUT",
            body: JSON.stringify({ key, value }),
        });
    }

    async addSnapshots(snapshots: CreateSnapshotInput[]): Promise<void> {
        await apiFetch<{ success: boolean; }>("/api/snapshots", this.token, {
            method: "POST",
            body: JSON.stringify({ snapshots }),
        });
    }

    /** Provision data sources on the Notion side. Used by SwrStore to self-heal. */
    async init(): Promise<void> {
        await apiFetch<{ ok: boolean; }>("/api/init", this.token, { method: "POST" });
    }
}

// ─── IdbStore — talks to IndexedDB only ───────────────────────

export class IdbStore implements DataStore {
    readonly mode: StoreMode = "local-only";
    readonly canWrite = true;

    private namespace: string;

    constructor(namespace: string) {
        this.namespace = namespace;
    }

    private db() {
        return openIdb(this.namespace);
    }

    async getTransfers(): Promise<Transfer[]> {
        const db = await this.db();
        const rows = await db.getAll("transfers");
        return rows.map(({ _updatedAt: _ignored, ...rest }) => rest);
    }

    async getConfig(): Promise<ConfigRow[]> {
        const db = await this.db();
        const rows = await db.getAll("config");
        return rows.map(({ _updatedAt: _ignored, ...rest }) => rest);
    }

    async getLastSyncedAt(): Promise<number | null> {
        const db = await this.db();
        const row = await db.get("meta", "lastSyncedAt");
        return row ? (row.value as number) : null;
    }

    async revalidate(): Promise<void> {
        // IDB is the source of truth in local-only mode.
    }

    async addTransfer(input: CreateTransferInput): Promise<Transfer> {
        const row: Transfer = { id: crypto.randomUUID(), ...input };
        const db = await this.db();
        await db.put("transfers", { ...row, _updatedAt: Date.now() });
        return row;
    }

    async saveConfig(key: string, value: unknown): Promise<void> {
        const db = await this.db();
        await db.put("config", { key, value, _updatedAt: Date.now() });
    }

    async addSnapshots(_snapshots: CreateSnapshotInput[]): Promise<void> {
        // Snapshots have no local read path yet; intentionally no-op.
    }

    // ── Internal mutators used by SwrStore as cache writes ──

    async replaceTransfers(rows: Transfer[]): Promise<void> {
        const db = await this.db();
        const now = Date.now();
        const tx = db.transaction("transfers", "readwrite");
        await tx.store.clear();
        for (const row of rows) await tx.store.put({ ...row, _updatedAt: now });
        await tx.done;
    }

    async replaceConfig(rows: ConfigRow[]): Promise<void> {
        const db = await this.db();
        const now = Date.now();
        const tx = db.transaction("config", "readwrite");
        await tx.store.clear();
        for (const row of rows) await tx.store.put({ ...row, _updatedAt: now });
        await tx.done;
    }

    async putTransfer(row: Transfer): Promise<void> {
        const db = await this.db();
        await db.put("transfers", { ...row, _updatedAt: Date.now() });
    }

    async setMeta(key: string, value: unknown): Promise<void> {
        const db = await this.db();
        await db.put("meta", { key, value, updatedAt: Date.now() });
    }
}

// ─── SwrStore — IdbStore cache backed by NotionStore SoT ──────

export class SwrStore implements DataStore {
    readonly mode = "online" as const;
    readonly canWrite = true;

    private cache: IdbStore;
    private remote: NotionStore;

    constructor(cache: IdbStore, remote: NotionStore) {
        this.cache = cache;
        this.remote = remote;
    }

    getTransfers() {
        return this.cache.getTransfers();
    }
    getConfig() {
        return this.cache.getConfig();
    }
    getLastSyncedAt() {
        return this.cache.getLastSyncedAt();
    }

    async revalidate(): Promise<void> {
        try {
            await this.syncFromRemote();
        } catch (err) {
            if (err instanceof DataSourceNotFoundError) {
                // First-run or backend wiped — provision data sources and retry once.
                await this.remote.init();
                await this.syncFromRemote();
                return;
            }
            throw err;
        }
    }

    private async syncFromRemote(): Promise<void> {
        const [transfers, config] = await Promise.all([
            this.remote.getTransfers(),
            this.remote.getConfig(),
        ]);
        await Promise.all([
            this.cache.replaceTransfers(transfers),
            this.cache.replaceConfig(config),
            this.cache.setMeta("lastSyncedAt", Date.now()),
        ]);
    }

    async addTransfer(input: CreateTransferInput): Promise<Transfer> {
        const row = await this.remote.addTransfer(input);
        try {
            await this.cache.putTransfer(row);
        } catch (err) {
            console.warn("Failed to cache new transfer", err);
        }
        return row;
    }

    async saveConfig(key: string, value: unknown): Promise<void> {
        await this.remote.saveConfig(key, value);
        try {
            await this.cache.saveConfig(key, value);
        } catch (err) {
            console.warn("Failed to cache config", err);
        }
    }

    async addSnapshots(snapshots: CreateSnapshotInput[]): Promise<void> {
        await this.remote.addSnapshots(snapshots);
    }
}

// ─── ReadOnlyStore — decorator forbidding writes ──────────────

export class ReadOnlyStore implements DataStore {
    readonly mode = "offline" as const;
    readonly canWrite = false;

    private inner: DataStore;

    constructor(inner: DataStore) {
        this.inner = inner;
    }

    getTransfers() {
        return this.inner.getTransfers();
    }
    getConfig() {
        return this.inner.getConfig();
    }
    getLastSyncedAt() {
        return this.inner.getLastSyncedAt();
    }
    revalidate() {
        return this.inner.revalidate();
    }

    addTransfer(): Promise<Transfer> {
        throw new Error("Read-only mode");
    }
    saveConfig(): Promise<void> {
        throw new Error("Read-only mode");
    }
    addSnapshots(): Promise<void> {
        throw new Error("Read-only mode");
    }
}

// ─── Factory ──────────────────────────────────────────────────

export interface CreateDataStoreOptions {
    auth: { access_token: string; workspace_id?: string; } | null;
    readOnly?: boolean;
}

export function createDataStore({ auth, readOnly }: CreateDataStoreOptions): DataStore {
    if (!auth) {
        const idb = new IdbStore("local");
        return readOnly ? new ReadOnlyStore(idb) : idb;
    }
    const idb = new IdbStore(auth.workspace_id ?? "default");
    const swr = new SwrStore(idb, new NotionStore(auth.access_token));
    return readOnly ? new ReadOnlyStore(swr) : swr;
}
