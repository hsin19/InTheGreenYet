/**
 * Frontend API client — calls proxy endpoints.
 * All domain logic lives in proxy/src/notion.ts.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Setup: find or create the Transfer data source.
 * Returns the transferDataSourceId and whether it was newly created.
 */
export async function setup(
    token: string,
): Promise<{ transferDataSourceId: string; created: boolean; }> {
    const res = await fetch(`${API_BASE_URL}/api/setup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
    });
    const data = await res.json() as { transferDataSourceId?: string; created?: boolean; error?: string; };

    if (!res.ok) {
        throw new Error(data.error ?? `Setup failed: ${res.status}`);
    }

    return { transferDataSourceId: data.transferDataSourceId!, created: data.created! };
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

export async function fetchTransfers(token: string, dataSourceId: string): Promise<Transfer[]> {
    const res = await fetch(`${API_BASE_URL}/api/transfers?dataSourceId=${encodeURIComponent(dataSourceId)}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    });
    const data = await res.json() as { transfers?: Transfer[]; error?: string; };

    if (!res.ok) {
        throw new Error(data.error ?? `Fetch failed: ${res.status}`);
    }

    return data.transfers!;
}
