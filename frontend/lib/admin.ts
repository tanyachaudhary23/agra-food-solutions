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

/** Same as uploadFile, but reports progress (0 to 100) while the file is sent. */
export function uploadFileWithProgress(kind: "image" | "document", file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/admin/upload/${kind}`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onerror = () => reject(new Error("Cannot reach the server. Check your connection and that the backend is running."));
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status === 401) {
        tokenStore.clear();
        window.location.href = "/admin/login?expired=1";
        return reject(new Error("Please sign in again."));
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) { onProgress(100); resolve(data.url); }
      else reject(new Error(data.error || `Upload failed (${xhr.status})`));
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** "5 min ago", "yesterday", or the date for older items. `iso` is the server's UTC timestamp without a zone. */
export function timeAgo(iso: string): string {
  const t = new Date(iso.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const STATUS_LABEL: Record<string, string> = { new: "New", in_progress: "In progress", quoted: "Quoted", closed: "Closed" };
