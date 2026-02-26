/**
 * Frontend API client — calls proxy endpoints.
 * All domain logic lives in proxy/src/notion.ts.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Setup: find or create the Transaction data source.
 * Returns the transactionDataSourceId and whether it was newly created.
 */
export async function setup(
    token: string,
): Promise<{ transactionDataSourceId: string; created: boolean; }> {
    const res = await fetch(`${API_BASE_URL}/api/setup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
    });
    const data = await res.json() as { transactionDataSourceId?: string; created?: boolean; error?: string; };

    if (!res.ok) {
        throw new Error(data.error ?? `Setup failed: ${res.status}`);
    }

    return { transactionDataSourceId: data.transactionDataSourceId!, created: data.created! };
}
