// Shared data contract used by BOTH the SPA (src/) and the Worker (worker/).
// Pure types only — no runtime code and no platform-specific (DOM / workerd)
// dependencies — so it compiles cleanly under both tsconfig projects.
// Client imports it via the `@shared` alias; the Worker via relative `../shared`.

export interface Transfer {
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

export type CreateTransferInput = Omit<Transfer, "id">;

export interface ConfigRow {
    key: string;
    value: unknown;
}

export interface Snapshot {
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

export interface BinanceBalanceRequest {
    apiKey: string;
    apiSecret: string;
    currency: string;
}

export interface BitgetBalanceRequest {
    apiKey: string;
    apiSecret: string;
    passphrase: string;
}

export interface MaxBalanceRequest {
    apiKey: string;
    apiSecret: string;
}

export interface ProviderBalance {
    total: number;
    currency: string;
    fetchedAt: string;
}
