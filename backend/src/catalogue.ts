import PDFDocument from "pdfkit";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, publicUploadDir } from "./db.js";
import { config } from "./config.js";
import { getSettings } from "./settings.js";
import { listProducts } from "./products.js";
import { toRelative } from "./uploads.js";

/**
 * Builds the downloadable product catalogue (PDF) from the live database:
 * published products only, in category order. Nothing is stored; it is rebuilt
 * automatically whenever products, categories or contact settings change.
 */

const C = { forest: "#172B29", ivory: "#F4F0E8", brass: "#C5A36B", brassDark: "#8F7240", charcoal: "#252B29", grey: "#E7E9E6" };
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const CONTENT_W = PAGE_W - 2 * M;
const COLS = 3;
const GAP = 14;
const COL_W = (CONTENT_W - GAP * (COLS - 1)) / COLS;
const IMG_H = 104;
const CARD_H = 170;
const BAND_H = 34;
const TOP = M + BAND_H + 16;
const ROWS = Math.floor((PAGE_H - 46 - TOP) / CARD_H);

/** The built-in PDF fonts only cover Latin text, so common typographic characters are mapped and anything else is dropped. */
const latin = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/₹/g, "Rs ")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();

type Cat = { slug: string; name: string; description: string };

async function thumb(src: string): Promise<Buffer | null> {
  try {
    const rel = toRelative(src);
    if (!rel.startsWith("/uploads/")) return null;
    const file = path.join(publicUploadDir, path.basename(rel));
    if (!fs.existsSync(file)) return null;
    return await sharp(file).rotate().resize(360, 270, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 72 }).toBuffer();
  } catch {
    return null;
  }
}

async function build(): Promise<Buffer> {
  const s = getSettings();
  const categories = db.prepare("SELECT slug, name, description FROM categories ORDER BY sort_order, id").all() as Cat[];
  const products = listProducts(true);
  const byCat = categories.map((c) => ({ ...c, items: products.filter((p) => p.category === c.slug) })).filter((c) => c.items.length);

  // Prepare images (a few at a time to keep memory low)
  const images = new Map<number, Buffer | null>();
  const queue = products.filter((p) => p.images[0]);
  for (let i = 0; i < queue.length; i += 8) {
    await Promise.all(queue.slice(i, i + 8).map(async (p) => images.set(p.id, await thumb(p.images[0].src))));
  }

  const doc = new PDFDocument({ size: "A4", margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true, autoFirstPage: false, info: { Title: "Agra Food Solutions Pvt. Ltd. - Product Catalogue", Author: "Agra Food Solutions Pvt. Ltd." } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const siteUrl = config.frontendOrigins[0] && !/localhost|127\.0\.0\.1/.test(config.frontendOrigins[0]) ? config.frontendOrigins[0] : "";
  const contactLines = [
    s.email,
    ...s.phones,
    s.landline && `Landline: ${s.landline}`,
    s.factoryAddress && `Factory: ${s.factoryAddress}`,
    s.registeredOffice && `Registered office: ${s.registeredOffice}`,
    siteUrl,
  ].filter(Boolean).map((l) => latin(String(l)));

  // ---- Cover ----
  doc.addPage();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.forest);
  doc.rect(M, 150, 60, 3).fill(C.brass);
  doc.fillColor(C.ivory).font("Helvetica-Bold").fontSize(64).text("AFS", M, 172, { lineBreak: false });
  doc.fillColor(C.brass).font("Helvetica-Bold").fontSize(11).text("AGRA FOOD SOLUTIONS PVT. LTD.", M, 250, { characterSpacing: 3, lineBreak: false });
  doc.fillColor(C.ivory).font("Helvetica").fontSize(36).text("Product Catalogue", M, 330, { lineBreak: false });
  doc.fillColor(C.ivory).opacity(0.8).font("Helvetica").fontSize(13).text("Spare parts for roller flour mills, rice mills and the wider grain milling industry.", M, 385, { width: 400 }).opacity(1);
  const edition = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  doc.fillColor(C.brass).fontSize(10).text(`Edition: ${edition}  |  ${products.length} products in ${byCat.length} categories`, M, 450, { lineBreak: false });
  if (contactLines.length) {
    doc.rect(M, 640, CONTENT_W, 0.7).fill(C.brass);
    doc.fillColor(C.ivory).font("Helvetica").fontSize(9.5).text(contactLines.join("\n"), M, 654, { width: CONTENT_W, lineGap: 3 });
  }

  // ---- Contents (filled in after the product pages are placed) ----
  doc.addPage();

  // ---- Products ----
  const startPage = new Map<string, number>();
  let pageNo = 2; // zero-based index of the current page: cover=0, contents=1
  const band = (title: string, cont: boolean) => {
    doc.rect(0, M - 8, PAGE_W, BAND_H).fill(C.forest);
    doc.fillColor(C.ivory).font("Helvetica-Bold").fontSize(13).text(latin(title) + (cont ? " (continued)" : ""), M, M + 2, { width: CONTENT_W, lineBreak: false, ellipsis: true });
  };

  for (const cat of byCat) {
    for (let i = 0; i < cat.items.length; i++) {
      const slot = i % (COLS * ROWS);
      if (slot === 0) {
        doc.addPage();
        pageNo = doc.bufferedPageRange().count - 1;
        if (i === 0) {
          startPage.set(cat.slug, pageNo + 1);
          doc.outline.addItem(latin(cat.name));
        }
        band(cat.name, i > 0);
      }
      const p = cat.items[i];
      const col = slot % COLS;
      const row = Math.floor(slot / COLS) % ROWS;
      const x = M + col * (COL_W + GAP);
      const y = TOP + row * CARD_H;

      // image box
      doc.rect(x, y, COL_W, IMG_H).lineWidth(0.6).fillAndStroke("#ffffff", "#D5D8D3");
      const img = images.get(p.id);
      if (img) doc.image(img, x + 1, y + 1, { fit: [COL_W - 2, IMG_H - 2], align: "center", valign: "center" });
      else doc.fillColor("#9AA09C").font("Helvetica").fontSize(8).text("Photo on request", x, y + IMG_H / 2 - 4, { width: COL_W, align: "center", lineBreak: false });

      // text
      let ty = y + IMG_H + 8;
      doc.fillColor(C.charcoal).font("Helvetica-Bold").fontSize(9.5);
      const name = latin(p.name);
      doc.text(name, x, ty, { width: COL_W, height: 24, ellipsis: true, lineGap: 1 });
      ty += doc.heightOfString(name, { width: COL_W, lineGap: 1 }) > 13 ? 26 : 14;
      if (p.code) { doc.fillColor(C.brassDark).font("Helvetica-Bold").fontSize(7.5).text(latin(p.code), x, ty, { width: COL_W, lineBreak: false }); ty += 11; }
      doc.fillColor(C.charcoal).font("Helvetica").fontSize(7.5);
      // At most two detail lines per product (specifications first, then colour/size options) so every card stays the same height.
      const details = [...p.specifications.map((sp) => `${latin(sp.label)}: ${latin(sp.value)}`), ...(p.variants.length ? [`Options: ${latin(p.variants.join(", "))}`] : [])].slice(0, 2);
      for (const line of details) {
        doc.text(line, x, ty, { width: COL_W, height: 10, lineBreak: false, ellipsis: true });
        ty += 10;
      }
    }
  }

  // ---- Closing page ----
  doc.addPage();
  const closingPage = doc.bufferedPageRange().count;
  doc.outline.addItem("How to order");
  band("How to order", false);
  let y = TOP + 6;
  doc.fillColor(C.forest).font("Helvetica-Bold").fontSize(16).text("For a faster quotation, send us:", M, y, { width: CONTENT_W });
  y += 34;
  doc.fillColor(C.charcoal).font("Helvetica").fontSize(11.5);
  for (const t of ["Product name or part number", "Size, dimensions and material", "Quantity required", "A drawing, sample photo or old part reference", "Destination country"]) {
    doc.rect(M, y + 5, 5, 5).fill(C.brass);
    doc.fillColor(C.charcoal).text(t, M + 16, y, { width: CONTENT_W - 16 });
    y += 24;
  }
  y += 14;
  doc.fillColor(C.charcoal).opacity(0.85).fontSize(10.5).text("Dimensions, materials, grades and availability are confirmed against your enquiry before a quotation is issued.", M, y, { width: CONTENT_W });
  doc.opacity(1);
  y += 52;
  doc.rect(M, y, CONTENT_W, 0.7).fill(C.brass);
  y += 16;
  doc.fillColor(C.forest).font("Helvetica-Bold").fontSize(12).text("Agra Food Solutions Pvt. Ltd.", M, y);
  y += 22;
  const registrations = [s.gst && `GST: ${s.gst}`, s.iec && `IEC: ${s.iec}`, s.cin && `CIN: ${s.cin}`].filter(Boolean).map((l) => latin(String(l)));
  doc.fillColor(C.charcoal).font("Helvetica").fontSize(10.5).text([...contactLines, ...registrations].join("\n"), M, y, { width: CONTENT_W, lineGap: 4 });

  // ---- Fill the contents page ----
  doc.switchToPage(1);
  band("Contents", false);
  let cy = TOP + 6;
  doc.font("Helvetica").fontSize(12);
  for (const cat of byCat) {
    doc.fillColor(C.forest).font("Helvetica-Bold").fontSize(12).text(latin(cat.name), M, cy, { width: CONTENT_W - 120, lineBreak: false, ellipsis: true });
    doc.fillColor(C.charcoal).font("Helvetica").fontSize(10).text(`${cat.items.length} product${cat.items.length === 1 ? "" : "s"}   p. ${startPage.get(cat.slug)}`, M, cy + 2, { width: CONTENT_W, align: "right", lineBreak: false });
    cy += 18;
    if (cat.description) {
      doc.fillColor(C.charcoal).opacity(0.7).font("Helvetica").fontSize(9).text(latin(cat.description), M, cy, { width: CONTENT_W - 120, lineBreak: false, ellipsis: true });
      doc.opacity(1);
      cy += 14;
    }
    cy += 10;
    doc.rect(M, cy - 5, CONTENT_W, 0.5).fill("#D5D8D3");
  }
  doc.fillColor(C.forest).font("Helvetica-Bold").fontSize(12).text("How to order", M, cy + 6, { width: CONTENT_W - 120, lineBreak: false });
  doc.fillColor(C.charcoal).font("Helvetica").fontSize(10).text(`p. ${closingPage}`, M, cy + 8, { width: CONTENT_W, align: "right", lineBreak: false });

  // ---- Footer on every page after the cover ----
  const total = doc.bufferedPageRange().count;
  for (let i = 1; i < total; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // allows writing inside the bottom margin without starting a new page
    doc.rect(M, PAGE_H - 36, CONTENT_W, 0.5).fill("#D5D8D3");
    doc.fillColor("#6B716E").font("Helvetica").fontSize(7.5).text("Agra Food Solutions Pvt. Ltd.  |  Product Catalogue", M, PAGE_H - 28, { width: CONTENT_W / 2, lineBreak: false });
    doc.text(`Page ${i + 1} of ${total}`, M + CONTENT_W / 2, PAGE_H - 28, { width: CONTENT_W / 2, align: "right", lineBreak: false });
  }
  doc.flushPages();
  doc.end();
  return done;
}

let cache: { key: string; pdf: Buffer } | null = null;
let inflight: { key: string; promise: Promise<Buffer> } | null = null;

const cacheKey = () =>
  crypto
    .createHash("sha1")
    .update(JSON.stringify([listProducts(true), db.prepare("SELECT * FROM categories ORDER BY id").all(), getSettings(), new Date().toISOString().slice(0, 7)]))
    .digest("hex");

/** Returns the catalogue PDF, rebuilding it only when the underlying data changed. */
export async function getCataloguePdf(): Promise<{ pdf: Buffer; key: string }> {
  const key = cacheKey();
  if (cache?.key === key) return { pdf: cache.pdf, key };
  if (!inflight || inflight.key !== key) {
    const promise = build().then((pdf) => { cache = { key, pdf }; return pdf; }).finally(() => { if (inflight?.key === key) inflight = null; });
    inflight = { key, promise };
  }
  return { pdf: await inflight.promise, key };
}
