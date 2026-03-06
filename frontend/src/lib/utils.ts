export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class DataSourceNotFoundError extends Error {
    constructor() {
        super("Data source not found");
        this.name = "DataSourceNotFoundError";
    }
}

export async function apiFetch<T>(
    path: string,
    token: string,
    options: RequestInit = {},
): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...((options.headers as Record<string, string>) ?? {}),
        },
    });
    const data = await res.json() as T & { error?: string };
    if (!res.ok) {
        if (res.status === 404 && data.error === "data_source_not_found") {
            throw new DataSourceNotFoundError();
        }
        throw new Error(data.error ?? `Request failed: ${res.status}`);
    }
    return data;
}
