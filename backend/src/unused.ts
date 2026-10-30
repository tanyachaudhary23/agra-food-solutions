import fs from "node:fs";
import path from "node:path";
import { db, publicUploadDir } from "./db.js";
import { toRelative } from "./uploads.js";

/** A file younger than this is never offered for cleanup: it may have just been uploaded in an editor that is not saved yet. */
const GRACE_MS = 24 * 60 * 60 * 1000;

export type UnusedFile = { name: string; bytes: number; modified: string; kind: "image" | "pdf" | "other" };

/** Every file name that some product (live, draft OR in the recycle bin, which can still be restored) points to. */
function usedNames(): Set<string> {
  const used = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v !== "string") return;
    const rel = toRelative(v);
    if (rel.startsWith("/uploads/")) used.add(path.basename(rel));
  };
  const rows = db.prepare("SELECT images, documents FROM products").all() as { images: string; documents: string }[];
  for (const r of rows) {
    for (const col of [r.images, r.documents]) {
      try {
        for (const item of JSON.parse(col) as { src?: string; href?: string }[]) { add(item.src); add(item.href); }
      } catch { /* a corrupt row cannot be read: treat nothing as used from it, but see the safety check below */ }
    }
  }
  return used;
}

/** Files in the public uploads folder that no product uses. */
export function findUnusedFiles(): UnusedFile[] {
  // Safety: if any product row cannot be parsed we cannot be sure what is used, so offer nothing.
  const rows = db.prepare("SELECT images, documents FROM products").all() as { images: string; documents: string }[];
  for (const r of rows) {
    try { JSON.parse(r.images); JSON.parse(r.documents); } catch { return []; }
  }
  const used = usedNames();
  const out: UnusedFile[] = [];
  for (const name of fs.readdirSync(publicUploadDir)) {
    if (used.has(name) || name.startsWith(".")) continue;
    const full = path.join(publicUploadDir, name);
    let st: fs.Stats;
    try { st = fs.statSync(full); } catch { continue; }
    if (!st.isFile() || Date.now() - st.mtimeMs < GRACE_MS) continue;
    const ext = path.extname(name).toLowerCase();
    out.push({ name, bytes: st.size, modified: st.mtime.toISOString(), kind: [".webp", ".jpg", ".jpeg", ".png", ".gif"].includes(ext) ? "image" : ext === ".pdf" ? "pdf" : "other" });
  }
  return out.sort((a, b) => b.bytes - a.bytes);
}

/** Deletes every currently-unused file. The list is recomputed here, never taken from the browser. */
export function deleteUnusedFiles(): { deleted: number; bytes: number } {
  let deleted = 0, bytes = 0;
  for (const f of findUnusedFiles()) {
    try { fs.unlinkSync(path.join(publicUploadDir, f.name)); deleted++; bytes += f.bytes; } catch { /* already gone */ }
  }
  return { deleted, bytes };
}
