import { API_URL } from "./api";

const KEY = "afs-admin-token";

export const tokenStore = {
  get(): string {
    try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; }
  },
  set(t: string) {
    try { sessionStorage.setItem(KEY, t); } catch { /* storage blocked */ }
  },
  clear() {
    try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
  },
};

type Opts = { method?: string; body?: unknown; form?: FormData };

async function raw(path: string, opts: Opts = {}) {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/admin${path}`, { method: opts.method || "GET", headers, body });
  } catch {
    throw new Error("Cannot reach the server. Check your connection and that the backend is running.");
  }
  if (res.status === 401 && path !== "/login") {
    tokenStore.clear();
    if (typeof window !== "undefined") window.location.href = "/admin/login?expired=1";
    throw new Error("Please sign in again.");
  }
  return res;
}

export async function adminFetch<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const res = await raw(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

async function saveBlob(res: Response, filename: string) {
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Downloads a protected file (the browser cannot send the login header on a normal link). */
export async function adminDownload(path: string, filename: string) {
  const res = await raw(path);
  if (!res.ok) throw new Error("Download failed.");
  await saveBlob(res, filename);
}

/** Sends a form (e.g. an uploaded spreadsheet) and saves the file the server answers with. */
export async function adminDownloadForm(path: string, form: FormData, filename: string) {
  const res = await raw(path, { method: "POST", form });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Download failed.");
  await saveBlob(res, filename);
}

export async function uploadFile(kind: "image" | "document", file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { url } = await adminFetch<{ url: string }>(`/upload/${kind}`, { method: "POST", form });
  return url;
}

export const STATUS_LABEL: Record<string, string> = { new: "New", in_progress: "In progress", quoted: "Quoted", closed: "Closed" };
