import { apiFetch } from "./utils";

export async function setup(token: string): Promise<{ transferDataSourceId: string; configDataSourceId: string; created: boolean }> {
    return apiFetch("/api/setup", token, { method: "POST" });
}

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

export async function fetchTransfers(token: string, dataSourceId: string): Promise<Transfer[]> {
    const data = await apiFetch<{ transfers: Transfer[] }>(
        `/api/transfers?dataSourceId=${encodeURIComponent(dataSourceId)}`,
        token,
    );
    return data.transfers;
}

export async function createTransfer(token: string, dataSourceId: string, input: CreateTransferInput): Promise<string> {
    const data = await apiFetch<{ id: string }>("/api/transfers", token, {
        method: "POST",
        body: JSON.stringify({ dataSourceId, ...input }),
    });
    return data.id;
}

export interface ConfigRow {
    key: string;
    value: unknown;
}

export async function fetchConfig(token: string, dataSourceId: string, key?: string): Promise<ConfigRow[]> {
    const params = new URLSearchParams({ dataSourceId });
    if (key) params.set("key", key);
    const data = await apiFetch<{ config: ConfigRow[] }>(`/api/config?${params}`, token);
    return data.config;
}
