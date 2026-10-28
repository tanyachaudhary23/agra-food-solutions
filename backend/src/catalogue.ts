import PDFDocument from "pdfkit";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, publicUploadDir } from "./db.js";
import { config } from "./config.js";
import { getSettings } from "./settings.js";
import { listProducts } from "./products.js";
import { toRelative } from "./uploads.js";

/**
 * Builds the downloadable product catalogue (PDF) from the live database:
 * published products only, in category order. Nothing is stored; it is rebuilt
 * automatically whenever products, categories or contact settings change.
 *
 * Design: quiet and editorial. Soft image tiles, thin hairlines, serif headings (Times) over
 * sans body text (Helvetica), one brass accent. Categories flow one after another instead of
 * each starting a new page. Contents, index, e-mail, phone and website entries are clickable.
 * Optional: put a light/transparent logo at backend/assets/logo.png and it appears on the cover.
 */

const C = {
  forest: "#172B29", ivory: "#F4F0E8", brass: "#C5A36B", brassDark: "#8F7240", charcoal: "#252B29",
  grey: "#6B716E", tile: "#F2F1EC", line: "#DDD9CF", dim: "#B9BFBA", soft: "#A3A8A4",
};
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;
const CONTENT_W = PAGE_W - 2 * M;
const COLS = 3;
const GAP = 18;
const COL_W = (CONTENT_W - GAP * (COLS - 1)) / COLS;
const TILE_H = 92;
const CARD_H = 160;
const OPENER_H = 58;
const TOP = 84; // first content line below the running header
const LIMIT = PAGE_H - 54; // lowest content line above the footer
const LOGO_FILE = fileURLToPath(new URL("../assets/logo.png", import.meta.url));

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

/** A picture on the soft tile colour, so photos with any background sit calmly together. */
async function thumb(src: string, w: number, h: number): Promise<Buffer | null> {
  try {
    const rel = toRelative(src);
    if (!rel.startsWith("/uploads/")) return null;
    const file = path.join(publicUploadDir, path.basename(rel));
    if (!fs.existsSync(file)) return null;
    return await sharp(file).rotate().resize(w, h, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    return null;
  }
}

/** Shortens text at a sentence (or word) boundary so it fits in `max` characters. */
function trimText(t: string, max: number): string {
  const s = latin(t);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (stop > max * 0.5) return cut.slice(0, stop + 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "...";
}

async function qrPng(text: string): Promise<Buffer | null> {
  try {
    const QR = (await import("qrcode")).default;
    return await QR.toBuffer(text, { margin: 0, width: 240, color: { dark: C.forest, light: "#ffffff" } });
  } catch {
    return null; // QR is a nice extra: never fail the catalogue because of it
  }
}

async function build(): Promise<Buffer> {
  const s = getSettings();
  const categories = db.prepare("SELECT slug, name, description FROM categories ORDER BY sort_order, id").all() as Cat[];
  const products = listProducts(true);
  const byCat = categories.map((c) => ({ ...c, items: products.filter((p) => p.category === c.slug) })).filter((c) => c.items.length);

  // Website links point at FRONTEND_URL. A localhost address is used only while developing (NODE_ENV is not "production"),
  // so a catalogue sent to buyers from the live server can never contain links to localhost.
  const site = config.frontendOrigins[0] || "";
  const siteUrl = site && (config.isProd ? !/localhost|127\.0\.0\.1/.test(site) : true) ? site.replace(/\/+$/, "") : "";
  const waDigits = s.whatsapp.replace(/\D/g, "");

  // A description repeated on many products is placeholder text: leave it out rather than print it 90 times.
  const descCount = new Map<string, number>();
  for (const p of products) if (p.shortDescription) descCount.set(p.shortDescription, (descCount.get(p.shortDescription) ?? 0) + 1);
  const descOf = (p: (typeof products)[number]) => {
    const n = descCount.get(p.shortDescription) ?? 0;
    return p.shortDescription && !(n >= 3 && n > products.length * 0.3) ? latin(p.shortDescription) : "";
  };

  // Prepare images (a few at a time to keep memory low)
  const images = new Map<number, Buffer | null>();
  const queue = products.filter((p) => p.images[0]);
  for (let i = 0; i < queue.length; i += 8) {
    await Promise.all(queue.slice(i, i + 8).map(async (p) => images.set(p.id, await thumb(p.images[0].src, 470, 280))));
  }
  const heroPick = [...queue.filter((p) => p.featured), ...queue.filter((p) => !p.featured)].filter((p) => images.get(p.id)).slice(0, 4);
  const heroImages = await Promise.all(heroPick.map((p) => thumb(p.images[0].src, 330, 420)));
  const qrTarget = siteUrl ? `${siteUrl}/contact` : waDigits ? `https://wa.me/${waDigits}` : "";
  const qr = qrTarget ? await qrPng(qrTarget) : null;
  const hasLogo = fs.existsSync(LOGO_FILE);

  const doc = new PDFDocument({
    size: "A4", margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true, autoFirstPage: false,
    info: {
      Title: "Agra Food Solutions Pvt. Ltd. - Product Catalogue", Author: "Agra Food Solutions Pvt. Ltd.",
      Subject: "Spare parts for roller flour mills, rice mills and grain milling plants",
      Keywords: "flour mill spare parts, rice mill spare parts, plansifter, roller mill, rubber parts, magnets, screens, India",
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ---------- small drawing helpers ----------
  const hr = (y: number, x = M, w = CONTENT_W, color = C.line) => doc.rect(x, y, w, 0.5).fill(color);
  const smallCaps = (t: string, x: number, y: number, color: string, opts: PDFKit.Mixins.TextOptions = {}) =>
    doc.fillColor(color).font("Helvetica-Bold").fontSize(7).text(latin(t).toUpperCase(), x, y, { characterSpacing: 1.6, lineBreak: false, ...opts });
  const header = (label = "Product Catalogue") => {
    smallCaps(label, M, 32, C.brassDark);
    doc.fillColor(C.grey).font("Helvetica").fontSize(7).text("AGRA FOOD SOLUTIONS", M, 32, { width: CONTENT_W, align: "right", characterSpacing: 1.6, lineBreak: false });
    hr(46);
    doc.rect(M, 45.25, 28, 1.5).fill(C.brass);
  };
  const pageTitle = (t: string) => doc.fillColor(C.forest).font("Times-Roman").fontSize(32).text(t, M, 66, { lineBreak: false });
  const link = (x: number, y: number, w: number, h: number, url: string) => doc.link(x, y, w, h, url);

  const phones = s.phones.map(latin).filter(Boolean);
  const firstPhone = (p: string) => "tel:" + p.replace(/[^\d+]/g, "");

  // =====================================================================
  // 1. Cover
  // =====================================================================
  doc.addPage();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.forest);
  doc.rect(M, 92, 44, 2.5).fill(C.brass);
  if (hasLogo) {
    try { doc.image(LOGO_FILE, M, 108, { fit: [180, 64] }); } catch { /* unreadable logo: fall back to the wordmark */ }
  } else {
    doc.fillColor(C.ivory).font("Times-Bold").fontSize(58).text("AFS", M, 106, { lineBreak: false });
  }
  doc.fillColor(C.brass).font("Helvetica-Bold").fontSize(9.5).text("AGRA FOOD SOLUTIONS PVT. LTD.", M, 182, { characterSpacing: 3, lineBreak: false });
  doc.fillColor(C.ivory).font("Times-Roman").fontSize(46).text("Product Catalogue", M, 236, { lineBreak: false });
  doc.fillColor(C.dim).font("Helvetica").fontSize(12.5).text("Spare parts for roller flour mills, rice mills and the wider grain milling industry.", M, 300, { width: 360, lineGap: 3 });
  const edition = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  doc.fillColor(C.brass).font("Helvetica-Bold").fontSize(8).text(`${edition}  ·  ${products.length} products  ·  ${byCat.length} categories`.toUpperCase(), M, 366, { characterSpacing: 1.6, lineBreak: false });

  if (heroPick.length) {
    const hw = (CONTENT_W - 3 * 10) / 4;
    heroPick.forEach((p, i) => {
      const x = M + i * (hw + 10);
      doc.rect(x, 440, hw, 150).fill("#ffffff");
      const b = heroImages[i];
      if (b) doc.image(b, x, 440, { fit: [hw, 150], align: "center", valign: "center" });
      doc.fillColor(C.dim).font("Helvetica").fontSize(7).text(latin(p.name), x, 598, { width: hw, height: 9, lineBreak: false, ellipsis: true });
    });
  }

  const coverLeft = [s.email, ...phones, s.landline && `Landline: ${s.landline}`].filter(Boolean).map((l) => latin(String(l)));
  const coverRight = [s.factoryAddress && `Factory: ${s.factoryAddress}`, s.registeredOffice && `Registered office: ${s.registeredOffice}`, siteUrl].filter(Boolean).map((l) => latin(String(l)));
  doc.rect(M, 664, CONTENT_W, 0.6).fill(C.brass);
  doc.fillColor(C.ivory).font("Helvetica").fontSize(8.5);
  if (coverLeft.length) doc.text(coverLeft.join("\n"), M, 680, { width: 210, lineGap: 3, height: 80 });
  if (coverRight.length) doc.text(coverRight.join("\n"), M + 240, 680, { width: CONTENT_W - 240, lineGap: 3, height: 80 });

  // =====================================================================
  // 2. Contents + about (filled in after the product pages are placed)
  // =====================================================================
  doc.addPage();

  // =====================================================================
  // 3. Products: categories flow one after another
  // =====================================================================
  const catPage = new Map<number, number>(); // category index -> page number
  const productPage = new Map<number, number>(); // product id -> page number
  let pageIdx = -1;
  let y = TOP;
  let col = 0;
  const newProductPage = (continuing?: string) => {
    doc.addPage();
    header(continuing ? `${continuing} - continued` : undefined); // the running header names the category, so no content space is lost
    pageIdx = doc.bufferedPageRange().count - 1;
    y = TOP;
    col = 0;
  };

  const drawCard = (p: (typeof products)[number], x: number, top: number) => {
    doc.addNamedDestination(`p-${p.id}`);
    doc.rect(x, top, COL_W, TILE_H).lineWidth(0.5).fillAndStroke("#ffffff", C.line);
    const img = images.get(p.id);
    if (img) doc.image(img, x + 0.5, top + 0.5, { fit: [COL_W - 1, TILE_H - 1], align: "center", valign: "center" });
    else doc.fillColor(C.soft).font("Helvetica").fontSize(6.5).text("PHOTO ON REQUEST", x, top + TILE_H / 2 - 3, { width: COL_W, align: "center", characterSpacing: 1.4, lineBreak: false });

    if (p.code) doc.fillColor(C.brassDark).font("Helvetica-Bold").fontSize(6.8).text(latin(p.code), x, top + TILE_H + 8, { width: COL_W, characterSpacing: 1, lineBreak: false });
    const name = latin(p.name);
    const ty = top + TILE_H + 19;
    doc.fillColor(C.charcoal).font("Times-Bold").fontSize(10.5);
    const twoLines = doc.heightOfString(name, { width: COL_W }) > 14;
    doc.text(name, x, ty, { width: COL_W, height: 25, ellipsis: true });

    // One or two quiet detail lines: description, specifications, compatibility, options.
    const desc = descOf(p);
    const details = [
      ...(desc ? [desc] : []),
      ...p.specifications.map((sp) => `${latin(sp.label)}: ${latin(sp.value)}`),
      ...(p.compatibility.length ? [`Fits: ${latin(p.compatibility.join(", "))}`] : []),
      ...(p.variants.length ? [`Options: ${latin(p.variants.join(", "))}`] : []),
    ].slice(0, twoLines ? 1 : 2);
    let dy = ty + (twoLines ? 26 : 14);
    doc.fillColor(C.grey).font("Helvetica").fontSize(7.2);
    for (const line of details) {
      doc.text(line, x, dy, { width: COL_W, height: 9, lineBreak: false, ellipsis: true });
      dy += 9.5;
    }
    if (siteUrl) link(x, top, COL_W, TILE_H + 56, `${siteUrl}/products/${p.slug}`);
  };

  byCat.forEach((cat, ci) => {
    if (pageIdx < 0 || y + OPENER_H + CARD_H > LIMIT) newProductPage();
    catPage.set(ci, pageIdx + 1);
    doc.addNamedDestination(`cat-${ci}`);
    doc.outline.addItem(latin(cat.name));

    // category opener: numeral, name, description, hairline
    doc.fillColor(C.brass).font("Times-Roman").fontSize(26).text(String(ci + 1).padStart(2, "0"), M, y, { lineBreak: false });
    doc.fillColor(C.forest).font("Times-Bold").fontSize(19).text(latin(cat.name), M + 46, y + 3, { width: CONTENT_W - 46 - 90, height: 24, lineBreak: false, ellipsis: true });
    doc.fillColor(C.grey).font("Helvetica").fontSize(7.5).text(`${cat.items.length} product${cat.items.length === 1 ? "" : "s"}`.toUpperCase(), M, y + 10, { width: CONTENT_W, align: "right", characterSpacing: 1.2, lineBreak: false });
    if (cat.description) doc.fillColor(C.grey).font("Helvetica").fontSize(8.5).text(latin(cat.description), M + 46, y + 28, { width: CONTENT_W - 46, height: 11, lineBreak: false, ellipsis: true });
    hr(y + 46, M, CONTENT_W, C.brass);
    y += OPENER_H;
    col = 0;

    cat.items.forEach((p, i) => {
      if (col === 0 && y + CARD_H > LIMIT) newProductPage(i > 0 ? latin(cat.name) : undefined);
      const x = M + col * (COL_W + GAP);
      drawCard(p, x, y);
      productPage.set(p.id, pageIdx + 1);
      col++;
      if (col === COLS) { col = 0; y += CARD_H; }
    });
    if (col !== 0) { col = 0; y += CARD_H; }
  });

  // =====================================================================
  // 4. Index (A-Z)
  // =====================================================================
  doc.addPage();
  header();
  const indexPage = doc.bufferedPageRange().count;
  doc.outline.addItem("Index");
  doc.addNamedDestination("index");
  pageTitle("Index");
  const IDX_COL_W = (CONTENT_W - 28) / 2;
  const IDX_ROW = 13.2;
  const IDX_TOP = 124;
  const perCol = Math.floor((LIMIT - IDX_TOP) / IDX_ROW);
  const sorted = [...products].sort((a, b) => latin(a.name).localeCompare(latin(b.name), "en", { sensitivity: "base" }));
  sorted.forEach((p, i) => {
    const pageOfEntry = Math.floor(i / (perCol * 2));
    if (i > 0 && i % (perCol * 2) === 0) { doc.addPage(); header(); }
    void pageOfEntry;
    const k = i % (perCol * 2);
    const column = Math.floor(k / perCol);
    const row = k % perCol;
    const x = M + column * (IDX_COL_W + 28);
    const ry = IDX_TOP + row * IDX_ROW;
    doc.fillColor(C.charcoal).font("Helvetica").fontSize(8.2).text(latin(p.name), x, ry, { width: IDX_COL_W - 92, height: 10, lineBreak: false, ellipsis: true });
    if (p.code) doc.fillColor(C.brassDark).font("Helvetica-Bold").fontSize(6.6).text(latin(p.code), x + IDX_COL_W - 88, ry + 1, { width: 56, lineBreak: false });
    doc.fillColor(C.grey).font("Helvetica").fontSize(8.2).text(String(productPage.get(p.id) ?? ""), x + IDX_COL_W - 28, ry, { width: 28, align: "right", lineBreak: false });
    doc.goTo(x, ry - 1, IDX_COL_W, IDX_ROW, `p-${p.id}`);
  });

  // =====================================================================
  // 5. How to order
  // =====================================================================
  doc.addPage();
  header();
  const closingPage = doc.bufferedPageRange().count;
  doc.outline.addItem("How to order");
  doc.addNamedDestination("order");
  pageTitle("How to order");
  doc.fillColor(C.grey).font("Helvetica").fontSize(11).text("For a faster quotation, please send us:", M, 118, { lineBreak: false });
  let oy = 152;
  ["Product name or part number", "Size, dimensions and material", "Quantity required", "A drawing, sample photo or old part reference", "Destination country"].forEach((t, i) => {
    doc.fillColor(C.brass).font("Times-Roman").fontSize(22).text(String(i + 1), M, oy, { lineBreak: false });
    doc.fillColor(C.charcoal).font("Helvetica").fontSize(12).text(t, M + 40, oy + 6, { width: CONTENT_W - 40, lineBreak: false });
    hr(oy + 32);
    oy += 38;
  });
  doc.fillColor(C.grey).font("Helvetica-Oblique").fontSize(9.5).text("Dimensions, materials, grades and availability are confirmed against your enquiry before a quotation is issued.", M, oy + 8, { width: CONTENT_W, height: 28 });
  oy += 52;

  const terms: [string, string][] = ([
    ["Minimum order", s.minimumOrder], ["Payment terms", s.paymentTerms], ["Incoterms", s.incoterms],
    ["Export documentation", s.exportDocumentation], ["Exporting to", s.exportRegions], ["Certifications", s.certifications.join(", ")],
  ] as [string, string][]).filter(([, v]) => v);
  if (terms.length) {
    smallCaps("Export and trade terms", M, oy, C.brassDark);
    oy += 18;
    for (const [k, v] of terms) {
      const val = latin(v);
      doc.font("Helvetica").fontSize(10);
      const h = Math.min(doc.heightOfString(val, { width: CONTENT_W - 140 }), 52);
      if (oy + h > 610) break;
      smallCaps(k, M, oy + 2, C.grey, { width: 130 });
      doc.fillColor(C.charcoal).font("Helvetica").fontSize(10).text(val, M + 140, oy, { width: CONTENT_W - 140, height: 52 });
      oy += h + 10;
      hr(oy - 5);
    }
  }

  // contact panel
  const PANEL_Y = 640;
  const PANEL_H = 140;
  doc.rect(M, PANEL_Y, CONTENT_W, PANEL_H).fill(C.forest);
  doc.fillColor(C.ivory).font("Times-Roman").fontSize(20).text("Agra Food Solutions Pvt. Ltd.", M + 22, PANEL_Y + 20, { lineBreak: false });
  const registrations = [s.gst && `GST: ${s.gst}`, s.iec && `IEC: ${s.iec}`, s.cin && `CIN: ${s.cin}`].filter(Boolean).map((l) => latin(String(l)));
  const panelLine1 = [s.email, siteUrl].filter(Boolean).map((l) => latin(String(l))).join("   ·   ");
  const panelLine2 = [...phones, s.landline && `Landline: ${s.landline}`].filter(Boolean).map((l) => latin(String(l))).join("   ·   ");
  const textW = qr ? CONTENT_W - 44 - 120 : CONTENT_W - 44;
  doc.fillColor(C.ivory).font("Helvetica").fontSize(8.8);
  doc.text([panelLine1, panelLine2].filter(Boolean).join("\n"), M + 22, PANEL_Y + 52, { width: textW, height: 26, lineGap: 3 });
  const addr = [s.factoryAddress && `Factory: ${s.factoryAddress}`, s.registeredOffice && `Registered office: ${s.registeredOffice}`].filter(Boolean).map((l) => latin(String(l)));
  if (addr.length) doc.fillColor(C.dim).fontSize(8).text(addr.join("\n"), M + 22, PANEL_Y + 78, { width: textW, height: 36, lineGap: 2 });
  if (registrations.length) doc.fillColor(C.brass).font("Helvetica-Bold").fontSize(7.5).text(registrations.join("    "), M + 22, PANEL_Y + PANEL_H - 22, { width: textW, characterSpacing: 0.6, lineBreak: false });
  if (qr) {
    const qx = M + CONTENT_W - 22 - 84;
    doc.rect(qx - 5, PANEL_Y + 22, 94, 94).fill("#ffffff");
    doc.image(qr, qx, PANEL_Y + 27, { fit: [84, 84] });
    doc.fillColor(C.brass).font("Helvetica-Bold").fontSize(6).text(siteUrl ? "SCAN TO ENQUIRE" : "SCAN FOR WHATSAPP", qx - 5, PANEL_Y + 120, { width: 94, align: "center", characterSpacing: 1.2, lineBreak: false });
    link(qx - 5, PANEL_Y + 22, 94, 94, qrTarget);
  }
  if (s.email) link(M + 22, PANEL_Y + 52, 120, 12, `mailto:${s.email}`);

  // =====================================================================
  // Fill the contents page (page 2)
  // =====================================================================
  doc.switchToPage(1);
  header();
  pageTitle("Contents");
  let cy = 126;
  const rows: { n: string; name: string; desc: string; count: string; page: number; dest: string }[] = [
    ...byCat.map((c, i) => ({ n: String(i + 1).padStart(2, "0"), name: latin(c.name), desc: latin(c.description || ""), count: `${c.items.length} product${c.items.length === 1 ? "" : "s"}`, page: catPage.get(i) ?? 0, dest: `cat-${i}` })),
    { n: "", name: "Index", desc: "", count: "A to Z", page: indexPage, dest: "index" },
    { n: "", name: "How to order", desc: "", count: "", page: closingPage, dest: "order" },
  ];
  for (const r of rows) {
    const rowH = r.desc ? 44 : 32;
    doc.fillColor(C.brass).font("Times-Roman").fontSize(15).text(r.n, M, cy + 1, { lineBreak: false });
    doc.fillColor(C.forest).font("Times-Roman").fontSize(15).text(r.name, M + 34, cy + 1, { width: 330, height: 18, lineBreak: false, ellipsis: true });
    doc.fillColor(C.grey).font("Helvetica").fontSize(7.5).text(r.count.toUpperCase(), M + CONTENT_W - 130, cy + 5, { width: 96, align: "right", characterSpacing: 1.1, lineBreak: false });
    doc.fillColor(C.forest).font("Helvetica-Bold").fontSize(9.5).text(String(r.page).padStart(2, "0"), M + CONTENT_W - 24, cy + 4, { width: 24, align: "right", lineBreak: false });
    if (r.desc) doc.fillColor(C.grey).font("Helvetica").fontSize(8).text(r.desc, M + 34, cy + 22, { width: 380, height: 10, lineBreak: false, ellipsis: true });
    hr(cy + rowH - 6);
    doc.goTo(M, cy - 3, CONTENT_W, rowH - 6, r.dest);
    cy += rowH;
  }

  // About (only what is filled in under Settings) and a contact panel anchored to the bottom
  const PANEL2_Y = 668;
  const showPanel = cy < PANEL2_Y - 20;
  let ay = cy + 22;
  const facts: [string, string][] = ([["Established", s.established], ["Certifications", s.certifications.join(", ")], ["Exporting to", s.exportRegions]] as [string, string][]).filter(([, v]) => v);
  if (s.aboutStory && ay + 80 < PANEL2_Y) {
    smallCaps("About us", M, ay, C.brassDark);
    ay += 16;
    const room = PANEL2_Y - ay - 16 - (facts.length ? facts.length * 18 + 8 : 0);
    let txt = trimText(s.aboutStory, 700);
    doc.font("Helvetica").fontSize(9.5);
    while (txt.length > 80 && doc.heightOfString(txt, { width: CONTENT_W * 0.8, lineGap: 3 }) > room) txt = trimText(txt, Math.floor(txt.length * 0.85));
    doc.fillColor(C.charcoal).text(txt, M, ay, { width: CONTENT_W * 0.8, lineGap: 3, height: Math.max(room, 20) });
    ay += Math.min(doc.heightOfString(txt, { width: CONTENT_W * 0.8, lineGap: 3 }), Math.max(room, 20)) + 10;
  }
  for (const [k, v] of facts) {
    if (ay + 16 > PANEL2_Y - 10) break;
    smallCaps(k, M, ay + 1, C.grey, { width: 110 });
    doc.fillColor(C.charcoal).font("Helvetica").fontSize(9).text(latin(v), M + 120, ay, { width: CONTENT_W - 120, height: 12, lineBreak: false, ellipsis: true });
    ay += 18;
  }
  if (showPanel) {
    doc.rect(M, PANEL2_Y, CONTENT_W, 100).fill(C.tile);
    const cw = (CONTENT_W - 44) / 3;
    const cols3: [string, string[]][] = [
      ["Call", [...phones, s.landline && `Landline: ${latin(s.landline)}`].filter(Boolean) as string[]],
      ["Write", [s.email && latin(s.email), siteUrl].filter(Boolean) as string[]],
      ["Visit", [s.factoryAddress && `Factory: ${latin(s.factoryAddress)}`, s.registeredOffice && `Registered office: ${latin(s.registeredOffice)}`].filter(Boolean) as string[]],
    ];
    cols3.forEach(([label, lines], i) => {
      if (!lines.length) return;
      const x = M + 22 + i * cw;
      smallCaps(label, x, PANEL2_Y + 18, C.brassDark);
      doc.fillColor(C.charcoal).font("Helvetica").fontSize(8).text(lines.join("\n"), x, PANEL2_Y + 32, { width: cw - 14, height: 62, lineGap: 2 });
    });
    if (s.email) link(M + 22 + cw, PANEL2_Y + 32, cw - 14, 10, `mailto:${s.email}`);
    phones.forEach((p, i) => link(M + 22, PANEL2_Y + 32 + i * 10, cw - 14, 10, firstPhone(p)));
  }

  // =====================================================================
  // Footer on every page after the cover
  // =====================================================================
  const total = doc.bufferedPageRange().count;
  for (let i = 1; i < total; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // allows writing inside the bottom margin without starting a new page
    hr(PAGE_H - 38, M, CONTENT_W, C.line);
    doc.fillColor(C.grey).font("Helvetica").fontSize(7).text("AGRA FOOD SOLUTIONS PVT. LTD.", M, PAGE_H - 28, { width: CONTENT_W / 2, characterSpacing: 1.4, lineBreak: false });
    doc.text(`${i + 1} / ${total}`, M + CONTENT_W / 2, PAGE_H - 28, { width: CONTENT_W / 2, align: "right", characterSpacing: 1.4, lineBreak: false });
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
    .update(JSON.stringify([listProducts(true), db.prepare("SELECT * FROM categories ORDER BY id").all(), getSettings(), fs.existsSync(LOGO_FILE), new Date().toISOString().slice(0, 7)]))
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
