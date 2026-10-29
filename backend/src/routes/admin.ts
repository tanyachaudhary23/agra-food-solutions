import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import { z } from "zod";
import { db, slugify, TRASH_RETENTION_DAYS, uniqueSlug } from "../db.js";
import { sendEnquiryEmail, type EnquiryForMail } from "../mail.js";
import { requireAdmin, signToken, type AdminRow } from "../auth.js";
import { nextProductCode, createProduct, getProductById, listDeletedProducts, listProducts, productSchema, updateProduct } from "../products.js";
import { getSettings, saveSettings, settingsSchema } from "../settings.js";
import { documentUpload, imageUpload, importUpload, savePublicImage, savePublicPdf } from "../uploads.js";
import { applyPlan, buildPlan, buildProblemsFile, buildTemplate, ImportError, publicPlan, readGrid } from "../import.js";
import { attachmentPath } from "./public.js";

export const adminRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // only failed attempts count, so normal use never locks the owner out
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => void res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." }),
});

adminRouter.post("/login", loginLimiter, (req, res) => {
  const { email, password } = (req.body || {}) as { email?: string; password?: string };
  const admin = db.prepare("SELECT id, email, password_hash, token_version FROM admins WHERE email = ?").get(String(email || "").trim().toLowerCase()) as AdminRow | undefined;
  // Compare against a dummy hash when the user is unknown so response time does not reveal valid emails.
  const hash = admin?.password_hash ?? "$2a$12$C6UzMDM.H6dfI/f/IKcEeO5hP5v1l0F3bYb0kQb3QJ9m2yq0m8W5S";
  const ok = bcrypt.compareSync(String(password || ""), hash);
  if (!admin || !ok) return void res.status(401).json({ error: "Incorrect email or password." });
  res.json({ token: signToken(admin), email: admin.email });
});

adminRouter.use(requireAdmin);

adminRouter.get("/me", (_req, res) => res.json({ email: res.locals.admin.email }));

adminRouter.post("/password", loginLimiter, (req, res) => {
  const { currentPassword, newPassword } = (req.body || {}) as { currentPassword?: string; newPassword?: string };
  const admin = res.locals.admin as AdminRow;
  if (!bcrypt.compareSync(String(currentPassword || ""), admin.password_hash)) return void res.status(400).json({ error: "Current password is incorrect." });
  if (String(newPassword || "").length < 10) return void res.status(400).json({ error: "New password must be at least 10 characters." });
  // Raising token_version signs out every other session; this one continues with a fresh token.
  db.prepare("UPDATE admins SET password_hash = ?, token_version = token_version + 1 WHERE id = ?").run(bcrypt.hashSync(String(newPassword), 12), admin.id);
  const fresh = db.prepare("SELECT id, email, password_hash, token_version FROM admins WHERE id = ?").get(admin.id) as AdminRow;
  res.json({ ok: true, token: signToken(fresh) });
});

adminRouter.post("/logout", (_req, res) => {
  db.prepare("UPDATE admins SET token_version = token_version + 1 WHERE id = ?").run((res.locals.admin as AdminRow).id);
  res.json({ ok: true });
});

// ---------- Dashboard ----------
adminRouter.get("/stats", (_req, res) => {
  const one = <T,>(sql: string) => db.prepare(sql).get() as T;
  res.json({
    deletedProducts: one<{ n: number }>("SELECT COUNT(*) n FROM products WHERE deleted_at IS NOT NULL").n,
    products: one<{ n: number }>("SELECT COUNT(*) n FROM products WHERE deleted_at IS NULL").n,
    published: one<{ n: number }>("SELECT COUNT(*) n FROM products WHERE deleted_at IS NULL AND status='published'").n,
    drafts: one<{ n: number }>("SELECT COUNT(*) n FROM products WHERE deleted_at IS NULL AND status='draft'").n,
    categories: one<{ n: number }>("SELECT COUNT(*) n FROM categories").n,
    enquiries: one<{ n: number }>("SELECT COUNT(*) n FROM enquiries WHERE deleted_at IS NULL").n,
    newEnquiries: one<{ n: number }>("SELECT COUNT(*) n FROM enquiries WHERE status='new' AND deleted_at IS NULL").n,
    last7Days: one<{ n: number }>("SELECT COUNT(*) n FROM enquiries WHERE created_at >= datetime('now','-7 days') AND deleted_at IS NULL").n,
    emailFailed: one<{ n: number }>("SELECT COUNT(*) n FROM enquiries WHERE email_status IN ('failed','not_configured') AND deleted_at IS NULL").n,
    deletedEnquiries: one<{ n: number }>("SELECT COUNT(*) n FROM enquiries WHERE deleted_at IS NOT NULL").n,
  });
});

// ---------- Uploads ----------
function handleUpload(kind: "image" | "document") {
  return [
    kind === "image" ? imageUpload : documentUpload,
    async (req: import("express").Request, res: import("express").Response) => {
      if (!req.file) return void res.status(400).json({ error: "No file received." });
      try {
        const rel = kind === "image" ? await savePublicImage(req.file.buffer) : savePublicPdf(req.file.buffer);
        const { toAbsolute } = await import("../uploads.js");
        res.json({ url: toAbsolute(rel) });
      } catch (e) {
        res.status(422).json({ error: e instanceof Error ? e.message : "Upload failed." });
      }
    },
  ] as const;
}
adminRouter.post("/upload/image", ...handleUpload("image"));
adminRouter.post("/upload/document", ...handleUpload("document"));

// ---------- Categories ----------
const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens").max(100).optional().or(z.literal("")),
  description: z.string().trim().max(300).default(""),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});

adminRouter.get("/categories", (_req, res) => {
  res.json(
    db.prepare(`SELECT c.id, c.slug, c.name, c.description, c.sort_order AS sortOrder, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS productCount FROM categories c ORDER BY c.sort_order, c.id`).all()
  );
});

adminRouter.post("/categories", (req, res) => {
  const p = categorySchema.safeParse(req.body);
  if (!p.success) return void res.status(422).json({ error: p.error.issues[0].message });
  const slug = uniqueSlug("categories", p.data.slug || slugify(p.data.name));
  const order = p.data.sortOrder || (db.prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM categories").get() as { n: number }).n;
  const r = db.prepare("INSERT INTO categories (slug, name, description, sort_order) VALUES (?, ?, ?, ?)").run(slug, p.data.name, p.data.description, order);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

adminRouter.put("/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  const p = categorySchema.safeParse(req.body);
  if (!p.success) return void res.status(422).json({ error: p.error.issues[0].message });
  const slug = uniqueSlug("categories", p.data.slug || slugify(p.data.name), id);
  const r = db.prepare("UPDATE categories SET slug=?, name=?, description=?, sort_order=? WHERE id=?").run(slug, p.data.name, p.data.description, p.data.sortOrder, id);
  if (!r.changes) return void res.status(404).json({ error: "Category not found" });
  res.json({ ok: true });
});

adminRouter.delete("/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  const n = (db.prepare("SELECT COUNT(*) n FROM products WHERE category_id = ?").get(id) as { n: number }).n;
  if (n > 0 && !(db.prepare("SELECT 1 FROM products WHERE category_id = ? AND deleted_at IS NULL").get(id)))
    return void res.status(409).json({ error: `This category only holds ${n} product(s) in the recycle bin. Delete them forever from Products > Deleted first.` });
  if (n > 0) return void res.status(409).json({ error: `This category still has ${n} product(s). Move or delete them first.` });
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  res.json({ ok: true });
});

// ---------- Product import (Excel / CSV) ----------
// Step 1 "preview" saves nothing; step 2 "confirm" re-reads the same file and saves the good rows. See import.ts.
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
adminRouter.get("/products/import/template.xlsx", async (_req, res) => {
  res.setHeader("Content-Type", XLSX);
  res.setHeader("Content-Disposition", 'attachment; filename="product-import-template.xlsx"');
  res.send(await buildTemplate());
});
// The same sheet pre-filled with the current products: the easy way to change many existing products.
adminRouter.get("/products/import/current.xlsx", async (_req, res) => {
  res.setHeader("Content-Type", XLSX);
  res.setHeader("Content-Disposition", 'attachment; filename="my-current-products.xlsx"');
  res.send(await buildTemplate(true));
});

const importHandler = (confirm: boolean) => [
  importUpload,
  async (req: import("express").Request, res: import("express").Response) => {
    if (!req.file) return void res.status(400).json({ error: "Choose an Excel (.xlsx) or CSV file first." });
    try {
      const plan = buildPlan(await readGrid(req.file.buffer)); // everything after this await is synchronous: the check and the save see the same catalogue
      if (!confirm) return void res.json(publicPlan(plan));
      const done = applyPlan(plan);
      res.json({ ok: true, ...done, skipped: plan.summary.errors + plan.summary.unchanged + plan.summary.skipped, summary: plan.summary });
    } catch (e) {
      if (e instanceof ImportError) return void res.status(422).json({ error: e.message });
      throw e;
    }
  },
] as const;
adminRouter.post("/products/import/preview", ...importHandler(false));
adminRouter.post("/products/import/confirm", ...importHandler(true));
// Only the rows with problems, with the bad cells highlighted and a note on what to fix: fix them and upload again.
adminRouter.post("/products/import/problems", importUpload, async (req, res) => {
  if (!req.file) return void res.status(400).json({ error: "Choose a file first." });
  try {
    const plan = buildPlan(await readGrid(req.file.buffer));
    if (!plan.summary.errors) return void res.status(422).json({ error: "No problems were found in this file." });
    res.setHeader("Content-Type", XLSX);
    res.setHeader("Content-Disposition", 'attachment; filename="rows-to-fix.xlsx"');
    res.send(await buildProblemsFile(plan));
  } catch (e) {
    if (e instanceof ImportError) return void res.status(422).json({ error: e.message });
    throw e;
  }
});

// ---------- Products ----------
adminRouter.get("/products/next-code", (_req, res) => res.json({ code: nextProductCode() }));
adminRouter.get("/products", (req, res) => res.json(req.query.view === "deleted" ? listDeletedProducts() : listProducts(false)));

adminRouter.get("/products/:id", (req, res) => {
  const p = getProductById(Number(req.params.id));
  if (!p) return void res.status(404).json({ error: "Product not found" });
  res.json(p);
});

const categoryExists = (id: number) => !!db.prepare("SELECT 1 FROM categories WHERE id = ?").get(id);

adminRouter.post("/products", (req, res) => {
  const p = productSchema.safeParse(req.body);
  if (!p.success) return void res.status(422).json({ error: `${p.error.issues[0].path.join(".")}: ${p.error.issues[0].message}` });
  if (!categoryExists(p.data.categoryId)) return void res.status(422).json({ error: "Choose a valid category." });
  res.status(201).json({ id: createProduct(p.data) });
});

adminRouter.put("/products/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!getProductById(id)) return void res.status(404).json({ error: "Product not found" });
  const p = productSchema.safeParse(req.body);
  if (!p.success) return void res.status(422).json({ error: `${p.error.issues[0].path.join(".")}: ${p.error.issues[0].message}` });
  if (!categoryExists(p.data.categoryId)) return void res.status(422).json({ error: "Choose a valid category." });
  updateProduct(id, p.data);
  res.json({ ok: true });
});

// Deleting only moves a product to the recycle bin: it vanishes from the website, catalogue PDF and enquiry forms at once, and can be restored for 30 days.
adminRouter.delete("/products/:id", (req, res) => {
  const r = db.prepare("UPDATE products SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL").run(Number(req.params.id));
  if (!r.changes) return void res.status(404).json({ error: "Product not found" });
  res.json({ ok: true });
});

// A restored product comes back as a Draft, so it never reappears on the website by surprise. Publish it again when ready.
adminRouter.post("/products/:id/restore", (req, res) => {
  const r = db.prepare("UPDATE products SET deleted_at = NULL, status = 'draft', updated_at = datetime('now') WHERE id = ? AND deleted_at IS NOT NULL").run(Number(req.params.id));
  if (!r.changes) return void res.status(404).json({ error: "Product not found in the recycle bin" });
  res.json({ ok: true });
});

adminRouter.delete("/products/:id/permanent", (req, res) => {
  const r = db.prepare("DELETE FROM products WHERE id = ? AND deleted_at IS NOT NULL").run(Number(req.params.id));
  if (!r.changes) return void res.status(404).json({ error: "Product not found in the recycle bin" });
  res.json({ ok: true });
});

// ---------- Settings ----------
adminRouter.get("/settings", (_req, res) => res.json(getSettings()));

adminRouter.put("/settings", (req, res) => {
  const p = settingsSchema.safeParse(req.body);
  if (!p.success) return void res.status(422).json({ error: `${p.error.issues[0].path.join(".")}: ${p.error.issues[0].message}` });
  saveSettings({ ...p.data, phones: p.data.phones.filter(Boolean), certifications: p.data.certifications.filter(Boolean) });
  res.json({ ok: true });
});

// ---------- Enquiries ----------
const STATUSES = ["new", "in_progress", "quoted", "closed"] as const;
type EnquiryRow = Record<string, string | number | null> & { id: number };

// `number` is the enquiry's position among all enquiries still active (1 = oldest), so it stays in step when one is deleted.
// An enquiry in the recycle bin shows the number it will get back if restored.
const SEQ_SQL = `CASE WHEN enquiries.deleted_at IS NULL
  THEN (SELECT COUNT(*) FROM enquiries e2 WHERE e2.deleted_at IS NULL AND e2.id <= enquiries.id)
  ELSE (SELECT COUNT(*) FROM enquiries e2 WHERE e2.deleted_at IS NULL AND e2.id < enquiries.id) + 1 END AS seq`;

adminRouter.get("/enquiries", (req, res) => {
  const status = String(req.query.status || "");
  const q = String(req.query.q || "").trim();
  const deleted = req.query.view === "deleted"; // the recycle bin
  const page = Math.max(1, Number(req.query.page) || 1);
  const per = 25;
  const where: string[] = [deleted ? "deleted_at IS NOT NULL" : "deleted_at IS NULL"];
  const args: (string | number)[] = [];
  if ((STATUSES as readonly string[]).includes(status)) { where.push("status = ?"); args.push(status); }
  if (q) {
    where.push("(name LIKE ? OR company LIKE ? OR email LIKE ? OR country LIKE ? OR product LIKE ? OR message LIKE ?)");
    args.push(...Array(6).fill(`%${q}%`));
  }
  const w = `WHERE ${where.join(" AND ")}`;
  const total = (db.prepare(`SELECT COUNT(*) n FROM enquiries ${w}`).get(...args) as { n: number }).n;
  const order = deleted ? "deleted_at DESC, id DESC" : "id DESC";
  const rows = db.prepare(`SELECT enquiries.*, ${SEQ_SQL} FROM enquiries ${w} ORDER BY ${order} LIMIT ${per} OFFSET ${(page - 1) * per}`).all(...args) as EnquiryRow[];
  res.json({ total, page, pages: Math.max(1, Math.ceil(total / per)), items: rows.map(mapEnquiry) });
});

/** Whole days left before a deleted enquiry is removed for good (never below 0). */
const daysLeft = (deletedAt: string) => Math.max(0, Math.ceil((new Date(deletedAt.replace(" ", "T") + "Z").getTime() + TRASH_RETENTION_DAYS * 86400000 - Date.now()) / 86400000));

const mapEnquiry = (r: EnquiryRow) => ({
  id: r.id, number: Number(r.seq) || null, createdAt: r.created_at, name: r.name, company: r.company, email: r.email, country: r.country, phone: r.phone,
  product: r.product, quantity: r.quantity, requirements: r.requirements, message: r.message,
  attachmentName: r.attachment_name, hasAttachment: !!r.attachment_file, status: r.status, notes: r.notes,
  emailStatus: r.email_status, emailError: r.email_error,
  deletedAt: r.deleted_at, daysLeft: r.deleted_at ? daysLeft(String(r.deleted_at)) : null,
});

const csvCell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // prevent spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

adminRouter.get("/enquiries.csv", (_req, res) => {
  const rows = db.prepare("SELECT * FROM enquiries WHERE deleted_at IS NULL ORDER BY id DESC").all() as EnquiryRow[];
  const head = ["No.", "Date (UTC)", "Status", "Name", "Company", "Email", "Country", "Phone", "Product", "Quantity", "Requirements", "Message", "Notes"];
  const body = rows.map((r, i) => [rows.length - i, r.created_at, r.status, r.name, r.company, r.email, r.country, r.phone, r.product, r.quantity, r.requirements, r.message, r.notes].map(csvCell).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="enquiries.csv"');
  res.send("\ufeff" + [head.map(csvCell).join(","), ...body].join("\r\n"));
});

adminRouter.get("/enquiries/:id", (req, res) => {
  const r = db.prepare(`SELECT enquiries.*, ${SEQ_SQL} FROM enquiries WHERE id = ?`).get(Number(req.params.id)) as EnquiryRow | undefined;
  if (!r) return void res.status(404).json({ error: "Enquiry not found" });
  res.json(mapEnquiry(r));
});

adminRouter.patch("/enquiries/:id", (req, res) => {
  const p = z.object({ status: z.enum(STATUSES).optional(), notes: z.string().max(5000).optional() }).safeParse(req.body);
  if (!p.success) return void res.status(422).json({ error: "Invalid update" });
  const id = Number(req.params.id);
  if (!db.prepare("SELECT 1 FROM enquiries WHERE id = ? AND deleted_at IS NULL").get(id)) return void res.status(404).json({ error: "Enquiry not found" });
  if (p.data.status) db.prepare("UPDATE enquiries SET status = ? WHERE id = ?").run(p.data.status, id);
  if (p.data.notes !== undefined) db.prepare("UPDATE enquiries SET notes = ? WHERE id = ?").run(p.data.notes, id);
  res.json({ ok: true });
});

adminRouter.post("/enquiries/:id/resend-email", async (req, res) => {
  const row = db.prepare("SELECT * FROM enquiries WHERE id = ? AND deleted_at IS NULL").get(Number(req.params.id)) as (EnquiryForMail & { id: number }) | undefined;
  if (!row) return void res.status(404).json({ error: "Enquiry not found" });
  const mail = await sendEnquiryEmail(row);
  db.prepare("UPDATE enquiries SET email_status = ?, email_error = ? WHERE id = ?").run(mail.status, mail.error ?? "", row.id);
  res.json({ ok: mail.status === "sent", emailStatus: mail.status, emailError: mail.error ?? "" });
});

// Deleting moves the enquiry to the recycle bin (nothing is removed yet; its attachment stays on disk).
adminRouter.delete("/enquiries/:id", (req, res) => {
  const r = db.prepare("UPDATE enquiries SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL").run(Number(req.params.id));
  if (!r.changes) return void res.status(404).json({ error: "Enquiry not found" });
  res.json({ ok: true, daysToRestore: TRASH_RETENTION_DAYS });
});

adminRouter.post("/enquiries/:id/restore", (req, res) => {
  const r = db.prepare("UPDATE enquiries SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL").run(Number(req.params.id));
  if (!r.changes) return void res.status(404).json({ error: "Enquiry not found in Deleted" });
  res.json({ ok: true });
});

// Empties one enquiry from the recycle bin right away. Only works on enquiries already in the bin.
adminRouter.delete("/enquiries/:id/permanent", (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare("SELECT attachment_file FROM enquiries WHERE id = ? AND deleted_at IS NOT NULL").get(id) as { attachment_file: string | null } | undefined;
  if (!r) return void res.status(404).json({ error: "Enquiry not found in Deleted" });
  db.prepare("DELETE FROM enquiries WHERE id = ?").run(id);
  if (r.attachment_file) {
    const p = attachmentPath(r.attachment_file);
    if (p) try { fs.unlinkSync(p); } catch { /* already gone */ }
  }
  res.json({ ok: true });
});

adminRouter.get("/enquiries/:id/attachment", (req, res) => {
  const r = db.prepare("SELECT attachment_name, attachment_file FROM enquiries WHERE id = ?").get(Number(req.params.id)) as { attachment_name: string | null; attachment_file: string | null } | undefined;
  const p = r?.attachment_file ? attachmentPath(r.attachment_file) : null;
  if (!r || !p) return void res.status(404).json({ error: "No attachment" });
  res.download(p, r.attachment_name || "attachment");
});
