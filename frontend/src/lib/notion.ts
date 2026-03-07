import { apiFetch } from "./api";

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

export async function fetchTransfers(token: string): Promise<Transfer[]> {
    const data = await apiFetch<{ transfers: Transfer[]; }>("/api/transfers", token);
    return data.transfers;
}

export async function createTransfer(token: string, input: CreateTransferInput): Promise<string> {
    const data = await apiFetch<{ id: string; }>("/api/transfers", token, {
        method: "POST",
        body: JSON.stringify(input),
    });
    return data.id;
}

export interface ConfigRow {
    key: string;
    value: unknown;
}

export async function init(token: string): Promise<void> {
    await apiFetch<{ ok: boolean; }>("/api/init", token, { method: "POST" });
}

export async function fetchConfig(token: string, key?: string): Promise<ConfigRow[]> {
    const params = new URLSearchParams();
    if (key) params.set("key", key);
    const query = params.toString();
    const data = await apiFetch<{ config: ConfigRow[]; }>(`/api/config${query ? `?${query}` : ""}`, token);
    return data.config;
}

export async function updateConfig(token: string, key: string, value: unknown): Promise<void> {
    await apiFetch<{ ok: boolean; }>("/api/config", token, {
        method: "PUT",
        body: JSON.stringify({ key, value }),
    });
}
