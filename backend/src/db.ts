import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { defaultIndustriesFor } from "./industries.js";

export const publicUploadDir = path.join(config.dataDir, "uploads", "public");
export const privateUploadDir = path.join(config.dataDir, "uploads", "private");
fs.mkdirSync(publicUploadDir, { recursive: true });
fs.mkdirSync(privateUploadDir, { recursive: true });

export const db = new Database(path.join(config.dataDir, "afs.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  short_description TEXT NOT NULL DEFAULT '',
  full_description TEXT NOT NULL DEFAULT '',
  specifications TEXT NOT NULL DEFAULT '[]',
  applications TEXT NOT NULL DEFAULT '[]',
  industries TEXT NOT NULL DEFAULT '[]',
  compatibility TEXT NOT NULL DEFAULT '[]',
  variants TEXT NOT NULL DEFAULT '[]',
  documents TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT '',
  quantity TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  attachment_name TEXT,
  attachment_file TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','quoted','closed')),
  notes TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_error TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

/** Gives every product its starting industry tags, based on its category (see industries.ts: a draft to be reviewed). */
export function tagDefaultIndustries() {
  const rows = db.prepare("SELECT p.id, c.slug AS cat FROM products p JOIN categories c ON c.id = p.category_id").all() as { id: number; cat: string }[];
  const upd = db.prepare("UPDATE products SET industries = ? WHERE id = ?");
  db.transaction(() => rows.forEach((r) => upd.run(JSON.stringify(defaultIndustriesFor(r.cat)), r.id)))();
}

// Databases created before industry tags existed get the new column, then the starting tags.
if (!(db.prepare("PRAGMA table_info(products)").all() as { name: string }[]).some((c) => c.name === "industries")) {
  db.exec("ALTER TABLE products ADD COLUMN industries TEXT NOT NULL DEFAULT '[]'");
  tagDefaultIndustries();
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "item";

/** Returns `base`, or `base-2`, `base-3`... so that the slug is unique in `table`. */
export function uniqueSlug(table: "products" | "categories", base: string, ignoreId?: number): string {
  let slug = base;
  let n = 2;
  const stmt = db.prepare(`SELECT id FROM ${table} WHERE slug = ?`);
  for (;;) {
    const row = stmt.get(slug) as { id: number } | undefined;
    if (!row || row.id === ignoreId) return slug;
    slug = `${base}-${n++}`;
  }
}
