export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

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
    if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
    return data;
}
