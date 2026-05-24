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

export interface CreateSnapshotInput {
    account: string;
    date: string;
    amount: number;
    currency: string;
}
