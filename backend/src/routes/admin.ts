import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import { z } from "zod";
import { db, slugify, uniqueSlug } from "../db.js";
import { requireAdmin, signToken, type AdminRow } from "../auth.js";
import { createProduct, getProductById, listProducts, productSchema, updateProduct } from "../products.js";
import { getSettings, saveSettings, settingsSchema } from "../settings.js";
import { documentUpload, imageUpload, savePublicImage, savePublicPdf } from "../uploads.js";
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
  const admin = db.prepare("SELECT id, email, password_hash FROM admins WHERE email = ?").get(String(email || "").trim().toLowerCase()) as AdminRow | undefined;
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
  db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(String(newPassword), 12), admin.id);
  res.json({ ok: true });
});

// ---------- Dashboard ----------
adminRouter.get("/stats", (_req, res) => {
  const one = <T,>(sql: string) => db.prepare(sql).get() as T;
  res.json({
    products: one<{ n: number }>("SELECT COUNT(*) n FROM products").n,
    published: one<{ n: number }>("SELECT COUNT(*) n FROM products WHERE status='published'").n,
    drafts: one<{ n: number }>("SELECT COUNT(*) n FROM products WHERE status='draft'").n,
    categories: one<{ n: number }>("SELECT COUNT(*) n FROM categories").n,
    enquiries: one<{ n: number }>("SELECT COUNT(*) n FROM enquiries").n,
    newEnquiries: one<{ n: number }>("SELECT COUNT(*) n FROM enquiries WHERE status='new'").n,
    last7Days: one<{ n: number }>("SELECT COUNT(*) n FROM enquiries WHERE created_at >= datetime('now','-7 days')").n,
    emailFailed: one<{ n: number }>("SELECT COUNT(*) n FROM enquiries WHERE email_status IN ('failed','not_configured')").n,
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
    db.prepare(`SELECT c.id, c.slug, c.name, c.description, c.sort_order AS sortOrder, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS productCount FROM categories c ORDER BY c.sort_order, c.id`).all()
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
  if (n > 0) return void res.status(409).json({ error: `This category still has ${n} product(s). Move or delete them first.` });
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  res.json({ ok: true });
});

// ---------- Products ----------
adminRouter.get("/products", (_req, res) => res.json(listProducts(false)));

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

adminRouter.delete("/products/:id", (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
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

adminRouter.get("/enquiries", (req, res) => {
  const status = String(req.query.status || "");
  const q = String(req.query.q || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const per = 25;
  const where: string[] = [];
  const args: (string | number)[] = [];
  if ((STATUSES as readonly string[]).includes(status)) { where.push("status = ?"); args.push(status); }
  if (q) {
    where.push("(name LIKE ? OR company LIKE ? OR email LIKE ? OR country LIKE ? OR product LIKE ? OR message LIKE ?)");
    args.push(...Array(6).fill(`%${q}%`));
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) n FROM enquiries ${w}`).get(...args) as { n: number }).n;
  const rows = db.prepare(`SELECT enquiries.*, (SELECT COUNT(*) FROM enquiries e2 WHERE e2.id <= enquiries.id) AS seq FROM enquiries ${w} ORDER BY id DESC LIMIT ${per} OFFSET ${(page - 1) * per}`).all(...args) as EnquiryRow[];
  res.json({ total, page, pages: Math.max(1, Math.ceil(total / per)), items: rows.map(mapEnquiry) });
});

// `number` is the enquiry's position among all enquiries still saved (1 = oldest), so it stays in step when one is deleted.
const mapEnquiry = (r: EnquiryRow) => ({
  id: r.id, number: Number(r.seq) || null, createdAt: r.created_at, name: r.name, company: r.company, email: r.email, country: r.country, phone: r.phone,
  product: r.product, quantity: r.quantity, requirements: r.requirements, message: r.message,
  attachmentName: r.attachment_name, hasAttachment: !!r.attachment_file, status: r.status, notes: r.notes,
  emailStatus: r.email_status, emailError: r.email_error,
});

const csvCell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // prevent spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

adminRouter.get("/enquiries.csv", (_req, res) => {
  const rows = db.prepare("SELECT * FROM enquiries ORDER BY id DESC").all() as EnquiryRow[];
  const head = ["No.", "Date (UTC)", "Status", "Name", "Company", "Email", "Country", "Phone", "Product", "Quantity", "Requirements", "Message", "Notes"];
  const body = rows.map((r, i) => [rows.length - i, r.created_at, r.status, r.name, r.company, r.email, r.country, r.phone, r.product, r.quantity, r.requirements, r.message, r.notes].map(csvCell).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="enquiries.csv"');
  res.send("﻿" + [head.map(csvCell).join(","), ...body].join("\r\n"));
});

adminRouter.get("/enquiries/:id", (req, res) => {
  const r = db.prepare("SELECT enquiries.*, "+"(SELECT COUNT(*) FROM enquiries e2 WHERE e2.id <= enquiries.id) AS seq"+" FROM enquiries WHERE id = ?").get(Number(req.params.id)) as EnquiryRow | undefined;
  if (!r) return void res.status(404).json({ error: "Enquiry not found" });
  res.json(mapEnquiry(r));
});

adminRouter.patch("/enquiries/:id", (req, res) => {
  const p = z.object({ status: z.enum(STATUSES).optional(), notes: z.string().max(5000).optional() }).safeParse(req.body);
  if (!p.success) return void res.status(422).json({ error: "Invalid update" });
  const id = Number(req.params.id);
  if (p.data.status) db.prepare("UPDATE enquiries SET status = ? WHERE id = ?").run(p.data.status, id);
  if (p.data.notes !== undefined) db.prepare("UPDATE enquiries SET notes = ? WHERE id = ?").run(p.data.notes, id);
  res.json({ ok: true });
});

adminRouter.delete("/enquiries/:id", (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare("SELECT attachment_file FROM enquiries WHERE id = ?").get(id) as { attachment_file: string | null } | undefined;
  if (r?.attachment_file) {
    const p = attachmentPath(r.attachment_file);
    if (p) fs.unlinkSync(p);
  }
  db.prepare("DELETE FROM enquiries WHERE id = ?").run(id);
  res.json({ ok: true });
});

adminRouter.get("/enquiries/:id/attachment", (req, res) => {
  const r = db.prepare("SELECT attachment_name, attachment_file FROM enquiries WHERE id = ?").get(Number(req.params.id)) as { attachment_name: string | null; attachment_file: string | null } | undefined;
  const p = r?.attachment_file ? attachmentPath(r.attachment_file) : null;
  if (!r || !p) return void res.status(404).json({ error: "No attachment" });
  res.download(p, r.attachment_name || "attachment");
});
