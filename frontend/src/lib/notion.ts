/**
 * Frontend API client — calls proxy endpoints.
 * All domain logic lives in proxy/src/notion.ts.
 */

/**
 * Setup: find or create the Transaction data source.
 * Returns the transactionDataSourceId and whether it was newly created.
 */
export async function setup(
    token: string,
): Promise<{ transactionDataSourceId: string; created: boolean }> {
    const res = await fetch('/api/setup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    })
    const data = await res.json() as { transactionDataSourceId?: string; created?: boolean; error?: string }

    if (!res.ok) {
        throw new Error(data.error ?? `Setup failed: ${res.status}`)
    }

    return { transactionDataSourceId: data.transactionDataSourceId!, created: data.created! }
}
