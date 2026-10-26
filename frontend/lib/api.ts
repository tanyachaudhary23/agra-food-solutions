/**
 * The website talks to the backend ONLY through this file.
 * Set NEXT_PUBLIC_API_URL to the address of your deployed backend (see .env.example).
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

/** Optional: a private/internal address for server-side calls (e.g. inside Docker). Falls back to API_URL. */
const SERVER_URL = (process.env.API_INTERNAL_URL || API_URL).replace(/\/+$/, "");

/** GET from the backend on the server. Returns null if the backend is unreachable or errors. Cached for 30 seconds. */
export async function apiGet<T>(path: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
