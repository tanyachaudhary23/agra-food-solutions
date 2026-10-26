import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { db, publicUploadDir, tagDefaultIndustries } from "./db.js";
import { defaultSettings, saveSettings } from "./settings.js";

const seedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "seed");

type SeedProduct = {
  name: string; slug: string; category: string; specifications: { label: string; value: string }[];
  variants: string[]; featured: boolean; image: string;
};

/** Loads the 90 products and 8 categories from the company catalogue the first time the database is empty. */
export function seedCatalogueIfEmpty() {
  const n = (db.prepare("SELECT COUNT(*) n FROM categories").get() as { n: number }).n;
  if (n > 0) return false;
  const data = JSON.parse(fs.readFileSync(path.join(seedDir, "products.json"), "utf8")) as {
    categories: { slug: string; name: string; description: string }[];
    products: SeedProduct[];
  };

  const insertCat = db.prepare("INSERT INTO categories (slug, name, description, sort_order) VALUES (?, ?, ?, ?)");
  const insertProd = db.prepare(
    `INSERT INTO products (code, slug, name, category_id, short_description, full_description, specifications, variants, images, featured, status, seo_title, seo_description, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`
  );

  db.transaction(() => {
    const catId = new Map<string, { id: number; name: string }>();
    data.categories.forEach((c, i) => catId.set(c.slug, { id: Number(insertCat.run(c.slug, c.name, c.description, i + 1).lastInsertRowid), name: c.name }));
    data.products.forEach((p, i) => {
      const cat = catId.get(p.category)!;
      const file = `seed-${p.slug}.jpg`;
      fs.copyFileSync(path.join(seedDir, "images", path.basename(p.image)), path.join(publicUploadDir, file));
      insertProd.run(
        `AFS-${String(i + 1).padStart(3, "0")}`, p.slug, p.name, cat.id,
        "Share your size, material and quantity to receive a quotation.",
        `${p.name} is listed in the Agra Food Solutions product catalogue (${cat.name}). Dimensions, materials, grades and availability are confirmed against your enquiry before a quotation is issued.`,
        JSON.stringify(p.specifications), JSON.stringify(p.variants),
        JSON.stringify([{ src: `/uploads/${file}`, alt: `${p.name}, ${cat.name}` }]),
        p.featured ? 1 : 0,
        `${p.name} | ${cat.name}`,
        `${p.name} from Agra Food Solutions Pvt. Ltd. Request a quotation with your size, material and quantity.`,
        i + 1
      );
    });
    saveSettings(defaultSettings);
  })();
  tagDefaultIndustries();
  return true;
}

export function createAdmin(email: string, password: string) {
  if (password.length < 10) throw new Error("Admin password must be at least 10 characters.");
  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT INTO admins (email, password_hash) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash").run(email.trim().toLowerCase(), hash);
}

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when no admin exists yet. */
export function ensureAdmin() {
  const n = (db.prepare("SELECT COUNT(*) n FROM admins").get() as { n: number }).n;
  if (n > 0) return;
  if (!config.adminEmail || !config.adminPassword) {
    console.warn("[admin] No admin account yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env and restart, or run: npm run create-admin -- you@example.com 'a-long-password'");
    return;
  }
  createAdmin(config.adminEmail, config.adminPassword);
  console.log(`[admin] Created admin account for ${config.adminEmail}. You can now remove ADMIN_PASSWORD from .env.`);
}
