import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { db, privateUploadDir } from "../db.js";
import { getSettings } from "../settings.js";
import { getProductBySlug, listProducts } from "../products.js";
import { enquiryUpload, savePrivateAttachment } from "../uploads.js";
import { sendEnquiryEmail } from "../mail.js";
import fs from "node:fs";
import path from "node:path";

export const publicRouter = Router();

// Used by hosting platforms to decide whether the server is healthy: also proves the database answers.
publicRouter.get("/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

publicRouter.get("/categories", (_req, res) => {
  res.json(db.prepare("SELECT slug, name, description FROM categories ORDER BY sort_order, id").all());
});

publicRouter.get("/products", (_req, res) => res.json(listProducts(true)));

publicRouter.get("/products/:slug", (req, res) => {
  const p = getProductBySlug(req.params.slug, true);
  if (!p) return void res.status(404).json({ error: "Product not found" });
  res.json(p);
});

publicRouter.get("/settings", (_req, res) => res.json(getSettings()));

// ---------- Enquiries ----------
const clean = (max: number) =>
  z.string().transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()).pipe(z.string().max(max));

const enquirySchema = z.object({
  name: clean(100).pipe(z.string().min(2, "Please enter your name")),
  company: clean(150).pipe(z.string().min(2, "Please enter your company name")),
  email: clean(150).pipe(z.string().email("Please enter a valid email address")),
  country: clean(80).pipe(z.string().min(2, "Please enter your country")),
  phone: clean(30).pipe(z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a phone number with country code, e.g. +44 20 1234 5678")),
  product: clean(2000), // a quote list can hold several products
  quantity: clean(60),
  requirements: clean(2000),
  message: clean(3000).pipe(z.string().min(10, "Please tell us a little more (at least 10 characters)")),
  consent: z.literal("true", { message: "Please accept the privacy consent" }),
});

const enquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => void res.status(429).json({ ok: false, errors: { form: "Too many enquiries from your network. Please try again in a few minutes." } }),
});

async function verifyTurnstile(token: string | undefined, ip: string) {
  if (!config.turnstileSecret) return true;
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: config.turnstileSecret, response: token, remoteip: ip }),
    });
    return !!((await r.json()) as { success?: boolean }).success;
  } catch {
    return false;
  }
}

publicRouter.post("/enquiries", enquiryLimiter, enquiryUpload, async (req, res) => {
  const body = (req.body || {}) as Record<string, string | undefined>;
  // Honeypot: bots fill the hidden "website" field. Pretend it worked.
  if ((body.website || "").length > 0) return void res.json({ ok: true });

  const ip = req.ip || "";
  if (!(await verifyTurnstile(body["cf-turnstile-response"], ip))) {
    return void res.status(400).json({ ok: false, errors: { form: "Spam check failed. Please reload the page and try again." } });
  }

  const raw = Object.fromEntries(
    ["name", "company", "email", "country", "phone", "product", "quantity", "requirements", "message", "consent"].map((k) => [k, String(body[k] ?? "")])
  );
  const parsed = enquirySchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) if (!errors[String(i.path[0])]) errors[String(i.path[0])] = i.message;
    return void res.status(422).json({ ok: false, errors });
  }

  let attachment: { stored: string; safeOriginal: string } | undefined;
  if (req.file && req.file.size > 0) {
    try {
      attachment = savePrivateAttachment(req.file.originalname, req.file.buffer);
    } catch (e) {
      return void res.status(422).json({ ok: false, errors: { file: e instanceof Error ? e.message : "Invalid file" } });
    }
  }

  const d = parsed.data;
  // Save FIRST so an enquiry is never lost even if email delivery fails.
  const result = db
    .prepare(
      `INSERT INTO enquiries (name, company, email, country, phone, product, quantity, requirements, message, attachment_name, attachment_file, ip)
       VALUES (@name, @company, @email, @country, @phone, @product, @quantity, @requirements, @message, @attachment_name, @attachment_file, @ip)`
    )
    .run({ ...d, attachment_name: attachment?.safeOriginal ?? null, attachment_file: attachment?.stored ?? null, ip });
  const id = Number(result.lastInsertRowid);

  const mail = await sendEnquiryEmail({ id, ...d, attachment_name: attachment?.safeOriginal, attachment_file: attachment?.stored });
  db.prepare("UPDATE enquiries SET email_status = ?, email_error = ? WHERE id = ?").run(mail.status, mail.error ?? "", id);
  if (mail.status === "failed") console.error(`[mail] enquiry #${id} saved but email failed: ${mail.error}`);

  res.json({ ok: true });
});

/** Used by the admin download route. */
export const attachmentPath = (file: string) => {
  const p = path.join(privateUploadDir, path.basename(file));
  return fs.existsSync(p) ? p : null;
};
