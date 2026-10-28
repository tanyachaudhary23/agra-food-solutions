import { z } from "zod";
import { db, slugify, TRASH_RETENTION_DAYS, uniqueSlug } from "./db.js";
import { toAbsolute, toRelative } from "./uploads.js";
import { INDUSTRY_SLUGS } from "./industries.js";

type Row = {
  id: number; code: string; slug: string; name: string; category_id: number; category_slug: string; category_name: string;
  short_description: string; full_description: string; specifications: string; applications: string; industries: string; compatibility: string;
  variants: string; documents: string; images: string; featured: number; status: "published" | "draft";
  seo_title: string; seo_description: string; sort_order: number; created_at: string; updated_at: string;
};

const SELECT = `SELECT p.*, c.slug AS category_slug, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id`;
const parse = <T,>(s: string, fallback: T): T => {
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

export function serializeProduct(r: Row, admin = false) {
  const images = parse<{ src: string; alt: string }[]>(r.images, []).map((i) => ({ src: toAbsolute(i.src), alt: i.alt }));
  const documents = parse<{ label: string; href: string }[]>(r.documents, []).map((d) => ({ label: d.label, href: toAbsolute(d.href) }));
  return {
    id: r.id,
    code: r.code,
    slug: r.slug,
    name: r.name,
    category: r.category_slug,
    categoryName: r.category_name,
    shortDescription: r.short_description,
    fullDescription: r.full_description,
    images,
    specifications: parse<{ label: string; value: string }[]>(r.specifications, []),
    applications: parse<string[]>(r.applications, []),
    industries: parse<string[]>(r.industries, []),
    compatibility: parse<string[]>(r.compatibility, []),
    variants: parse<string[]>(r.variants, []),
    documents,
    featured: !!r.featured,
    status: r.status,
    seoTitle: r.seo_title,
    seoDescription: r.seo_description,
    ...(admin ? { categoryId: r.category_id, sortOrder: r.sort_order, updatedAt: r.updated_at } : {}),
  };
}

export const listProducts = (publishedOnly: boolean) =>
  (db.prepare(`${SELECT} WHERE p.deleted_at IS NULL ${publishedOnly ? "AND p.status = 'published'" : ""} ORDER BY p.sort_order, p.id`).all() as Row[]).map((r) => serializeProduct(r, !publishedOnly));

export const getProductBySlug = (slug: string, publishedOnly: boolean) => {
  const r = db.prepare(`${SELECT} WHERE p.deleted_at IS NULL AND p.slug = ? ${publishedOnly ? "AND p.status = 'published'" : ""}`).get(slug) as Row | undefined;
  return r ? serializeProduct(r, !publishedOnly) : undefined;
};

/** Products in the recycle bin, most recently deleted first. `daysLeft` counts down to permanent removal. */
export const listDeletedProducts = () =>
  (db.prepare(`${SELECT} WHERE p.deleted_at IS NOT NULL ORDER BY p.deleted_at DESC, p.id DESC`).all() as (Row & { deleted_at: string })[]).map((r) => ({
    ...serializeProduct(r, true),
    deletedAt: r.deleted_at,
    daysLeft: Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - (Date.now() - new Date(r.deleted_at.replace(" ", "T") + "Z").getTime()) / 86400000)),
  }));

/** Which of these slugs are NOT live (deleted, drafted or never existed)? Used to refuse enquiries for products that are gone. */
export const unavailableSlugs = (slugs: string[]) => {
  const stmt = db.prepare("SELECT 1 FROM products WHERE slug = ? AND status = 'published' AND deleted_at IS NULL");
  return slugs.filter((s) => !stmt.get(s));
};

export const getProductById = (id: number) => {
  const r = db.prepare(`${SELECT} WHERE p.deleted_at IS NULL AND p.id = ?`).get(id) as Row | undefined;
  return r ? serializeProduct(r, true) : undefined;
};

const lines = z.array(z.string().trim().min(1).max(200)).max(50).default([]);
const ownFile = (v: string) => toRelative(v).startsWith("/uploads/");

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(150),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens").max(120).optional().or(z.literal("")),
  code: z.string().trim().max(40).default(""),
  categoryId: z.number().int(),
  shortDescription: z.string().trim().max(300).default(""),
  fullDescription: z.string().trim().max(5000).default(""),
  specifications: z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(200) })).max(40).default([]),
  applications: lines,
  industries: z.array(z.enum(INDUSTRY_SLUGS)).max(INDUSTRY_SLUGS.length).default([]).transform((a) => [...new Set(a)]),
  compatibility: lines,
  variants: lines,
  documents: z.array(z.object({ label: z.string().trim().min(1).max(100), href: z.string().max(500).refine(ownFile, "Documents must be uploaded through the admin panel") })).max(20).default([]),
  images: z.array(z.object({ src: z.string().max(500).refine(ownFile, "Images must be uploaded through the admin panel"), alt: z.string().trim().max(200).default("") })).max(12).default([]),
  featured: z.boolean().default(false),
  status: z.enum(["published", "draft"]).default("published"),
  seoTitle: z.string().trim().max(120).default(""),
  seoDescription: z.string().trim().max(300).default(""),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});
export type ProductInput = z.infer<typeof productSchema>;

const toColumns = (p: ProductInput) => ({
  code: p.code,
  name: p.name,
  category_id: p.categoryId,
  short_description: p.shortDescription,
  full_description: p.fullDescription,
  specifications: JSON.stringify(p.specifications),
  applications: JSON.stringify(p.applications),
  industries: JSON.stringify(p.industries),
  compatibility: JSON.stringify(p.compatibility),
  variants: JSON.stringify(p.variants),
  documents: JSON.stringify(p.documents.map((d) => ({ label: d.label, href: toRelative(d.href) }))),
  images: JSON.stringify(p.images.map((i) => ({ src: toRelative(i.src), alt: i.alt || p.name }))),
  featured: p.featured ? 1 : 0,
  status: p.status,
  seo_title: p.seoTitle,
  seo_description: p.seoDescription,
  sort_order: p.sortOrder,
});

/** The next free product code, AFS-091 style. Deleted products keep their numbers so a code is never reused. */
export function nextProductCode(): string {
  const rows = db.prepare("SELECT code FROM products").all() as { code: string }[];
  const max = rows.reduce((m, r) => Math.max(m, Number(/^AFS-(\d+)$/i.exec(r.code.trim())?.[1] ?? 0)), 0);
  return `AFS-${String(max + 1).padStart(3, "0")}`;
}

/** Gives every product that has no code the next AFS number (runs at server start). Returns how many were filled. */
export function fillMissingProductCodes(): number {
  const ids = db.prepare("SELECT id FROM products WHERE TRIM(code) = '' ORDER BY id").all() as { id: number }[];
  const set = db.prepare("UPDATE products SET code = ? WHERE id = ?");
  for (const r of ids) set.run(nextProductCode(), r.id);
  return ids.length;
}

export function createProduct(p: ProductInput): number {
  const cols = { ...toColumns(p) };
  if (!cols.code) cols.code = nextProductCode();
  const order = p.sortOrder || ((db.prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM products").get() as { n: number }).n);
  const slug = uniqueSlug("products", p.slug || slugify(p.name));
  const res = db
    .prepare(
      `INSERT INTO products (code, slug, name, category_id, short_description, full_description, specifications, applications, industries, compatibility, variants, documents, images, featured, status, seo_title, seo_description, sort_order)
       VALUES (@code, @slug, @name, @category_id, @short_description, @full_description, @specifications, @applications, @industries, @compatibility, @variants, @documents, @images, @featured, @status, @seo_title, @seo_description, @sort_order)`
    )
    .run({ ...cols, slug, sort_order: order });
  return Number(res.lastInsertRowid);
}

export function updateProduct(id: number, p: ProductInput) {
  const cols = { ...toColumns(p) };
  if (!cols.code) cols.code = nextProductCode();
  const slug = uniqueSlug("products", p.slug || slugify(p.name), id);
  db.prepare(
    `UPDATE products SET code=@code, slug=@slug, name=@name, category_id=@category_id, short_description=@short_description, full_description=@full_description,
     specifications=@specifications, applications=@applications, industries=@industries, compatibility=@compatibility, variants=@variants, documents=@documents, images=@images,
     featured=@featured, status=@status, seo_title=@seo_title, seo_description=@seo_description, sort_order=@sort_order, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...cols, slug, id });
}
