import ExcelJS from "exceljs";
import { db } from "./db.js";
import { INDUSTRIES } from "./industries.js";
import { createProduct, getProductById, listProducts, productSchema, updateProduct, type ProductInput } from "./products.js";
import { sniff } from "./uploads.js";

/**
 * Bulk product import from an Excel (.xlsx) or CSV file, designed so that someone with little spreadsheet
 * experience can fill it in and fix their own mistakes.
 *
 * Two steps, both from the same uploaded file (the server keeps nothing in between):
 *   1. preview: reads and checks every row, saves NOTHING, and reports new / update / unchanged / error per row.
 *   2. confirm: reads and checks the file again (so it is always judged against the current catalogue) and saves the good rows in one transaction.
 *
 * Rules: Name and Category are required. A row whose Code matches an existing product updates it (empty cells keep the
 * saved value, nothing is ever wiped); any other row creates a new product. An empty Code gets the next AFS number.
 * New products are Draft unless Status says Published. Rows with problems are skipped and listed, each problem naming the
 * exact cell and a suggested fix; the problem rows can be downloaded as a spreadsheet with the bad cells highlighted.
 * Photos cannot be imported; documents, photos, SEO fields, web address and ordering of existing products are never touched.
 */

export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const SPEC_PAIRS = 5;
const HINT_MARK = "▸"; // rows whose Name starts with this are the grey help line under the headings

/** A problem with the file as a whole (shown to the admin as is). */
export class ImportError extends Error {}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

type Group = "required" | "basic" | "spec" | "industry";
type Col = { key: string; label: string; group: Group; aliases: string[]; hint: string; width: number };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const COLS: Col[] = [
  { key: "name", label: "Name", group: "required", aliases: ["name", "productname"], hint: `${HINT_MARK} Required. The product name, e.g. Rubber Ball`, width: 32 },
  { key: "category", label: "Category", group: "required", aliases: ["category", "categoryname"], hint: `${HINT_MARK} Required. Pick from the list (click the cell, then the arrow)`, width: 30 },
  { key: "code", label: "Code", group: "basic", aliases: ["code", "productcode", "partnumber", "partno", "sku"], hint: `${HINT_MARK} Leave EMPTY for a new product (filled in automatically)`, width: 14 },
  { key: "shortDescription", label: "Short description", group: "basic", aliases: ["shortdescription", "shortdesc", "summary"], hint: `${HINT_MARK} One line shown on the product card`, width: 38 },
  { key: "fullDescription", label: "Full description", group: "basic", aliases: ["fulldescription", "longdescription", "details"], hint: `${HINT_MARK} Longer text for the product page`, width: 44 },
  { key: "status", label: "Status", group: "basic", aliases: ["status"], hint: `${HINT_MARK} Draft = hidden, Published = live. Empty = Draft`, width: 14 },
  ...Array.from({ length: SPEC_PAIRS }, (_, i) => i + 1).flatMap((k): Col[] => [
    { key: `spec${k}Name`, label: `Spec ${k} name`, group: "spec", aliases: [`spec${k}name`, `specification${k}name`, `spec${k}label`], hint: k === 1 ? `${HINT_MARK} What it is, e.g. Size` : `${HINT_MARK} e.g. Material`, width: 16 },
    { key: `spec${k}Value`, label: `Spec ${k} value`, group: "spec", aliases: [`spec${k}value`, `specification${k}value`], hint: k === 1 ? `${HINT_MARK} Its value, e.g. 16 to 50 mm` : `${HINT_MARK} e.g. Rubber`, width: 20 },
  ]),
  { key: "applications", label: "Applications", group: "basic", aliases: ["applications", "application", "uses"], hint: `${HINT_MARK} Separate with commas, e.g. Plansifter, Roller mill`, width: 34 },
  ...INDUSTRIES.map((i): Col => ({
    key: `ind:${i.slug}`, label: `Used in: ${i.name}`, group: "industry",
    aliases: [norm(`Used in ${i.name}`), norm(`Industry ${i.name}`), norm(i.name), norm(i.slug)], hint: `${HINT_MARK} Choose Yes if used here`, width: 16,
  })),
];
// Older / hand-made files may use one cell for all specifications or industries; both are still understood.
const LEGACY: Col[] = [
  { key: "specifications", label: "Specifications", group: "spec", aliases: ["specifications", "specification", "specs"], hint: "", width: 30 },
  { key: "industries", label: "Industries", group: "industry", aliases: ["industries", "industry"], hint: "", width: 30 },
];
const ALL_COLS = [...COLS, ...LEGACY];
const SILENT_COLUMNS = new Set(["whattofix", "rowinyourfile", "problems", "row", "no", "sno", "srno"]);
const labelOf = (key: string) => ALL_COLS.find((c) => c.key === key)?.label ?? key;

const letters = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

// ---------------------------------------------------------------------------
// Reading the file
// ---------------------------------------------------------------------------

type GridRow = { n: number; cells: string[] }; // n = the row number as the person sees it in Excel

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text?: string }[]).map((t) => t.text ?? "").join("");
    if ("result" in o) return cellText(o.result);
    if ("text" in o) return cellText(o.text);
  }
  return "";
}

async function readXlsx(buf: Buffer): Promise<GridRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  } catch {
    throw new ImportError("This file could not be read as an Excel workbook. Re-save it from Excel as .xlsx, or export it as CSV.");
  }
  const ws = wb.getWorksheet("Products") ?? wb.worksheets.find((w) => w.name !== "Start here" && w.name !== "Lists") ?? wb.worksheets[0];
  if (!ws) throw new ImportError("The workbook has no sheets.");
  const rows: GridRow[] = [];
  const last = Math.min(ws.rowCount, IMPORT_MAX_ROWS * 5);
  const cols = Math.min(Math.max(ws.columnCount, 1), 60);
  for (let r = 1; r <= last; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= cols; c++) cells.push(cellText(row.getCell(c).value).trim());
    if (cells.some(Boolean)) rows.push({ n: r, cells });
  }
  return rows;
}

function decodeText(buf: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buf); // CSV saved by older Excel versions
  }
}

/** A small RFC 4180 CSV reader: quoted fields, doubled quotes and line breaks inside quotes. */
function parseCsv(text: string): GridRow[] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => ({ d, n: first.split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const rows: GridRow[] = [];
  let cur: string[] = [];
  let field = "";
  let quoted = false;
  let record = 1; // the row number as Excel shows it: a cell with line breaks inside is still one row
  const endField = () => { cur.push(field.trim()); field = ""; };
  const endRow = () => {
    endField();
    if (cur.some(Boolean)) rows.push({ n: record, cells: cur });
    cur = [];
    record++;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delim) endField();
    else if (ch === "\n") endRow();
    else if (ch === "\r") { /* handled with \n */ }
    else field += ch;
    if (rows.length > IMPORT_MAX_ROWS * 5) break;
  }
  if (field !== "" || cur.length) endRow();
  return rows;
}

export async function readGrid(buf: Buffer): Promise<GridRow[]> {
  const kind = sniff(buf);
  if (kind === "zip") return readXlsx(buf);
  if (kind === "ole") throw new ImportError("Old Excel files (.xls) are not supported. In Excel choose Save As > Excel Workbook (.xlsx), or CSV.");
  // "AC" at the start is also the DWG signature, so only clearly non-text formats are refused here.
  if (buf.includes(0) || ["jpg", "png", "webp", "gif", "pdf"].includes(kind ?? "")) throw new ImportError("This does not look like a spreadsheet. Upload an .xlsx or .csv file.");
  return parseCsv(decodeText(buf));
}

// ---------------------------------------------------------------------------
// Checking the rows
// ---------------------------------------------------------------------------

/** One mistake, pointing at the exact cell. */
export type Problem = { column: string; cell: string; message: string; value: string; col: number };
export type RowPlan = {
  row: number;
  action: "new" | "update" | "unchanged" | "error" | "skipped";
  name: string;
  category: string;
  code: string;
  codeAuto: boolean;
  status: string; // draft | published | ""
  changes: string[];
  summary: string; // what a new product will contain
  errors: Problem[];
  warnings: string[];
  cells: string[]; // the row as typed (used for the "rows to fix" file, never sent to the browser)
  input?: ProductInput;
  id?: number;
};
export type Plan = {
  rows: RowPlan[];
  header: string[];
  colIndex: Record<string, number>;
  ignoredColumns: string[];
  summary: { total: number; created: number; updated: number; unchanged: number; errors: number; skipped: number; newWithoutIndustries: number };
};

const lev = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
/** The listed option closest to what was typed, or "" when nothing is close. */
function suggest(input: string, options: string[]): string {
  const n = norm(input);
  if (!n) return "";
  let best = "";
  let bd = 99;
  for (const o of options) {
    const on = norm(o);
    if (n.length >= 3 && (on.includes(n) || n.includes(on))) return o;
    const d = lev(n, on);
    if (d < bd) { bd = d; best = o; }
  }
  return bd <= Math.max(2, Math.floor(n.length * 0.34)) ? best : "";
}
const didYouMean = (value: string, options: string[], hintIfNone: string) => {
  const s = suggest(value, options);
  return s ? ` Did you mean "${s}"?` : ` ${hintIfNone}`;
};

const splitOn = (s: string, seps: RegExp) => s.split(seps).map((x) => x.trim()).filter(Boolean);
/** Applications may be separated by | ; or new lines, or (when none of those appear) by plain commas. */
const splitApplications = (s: string) => (/[|;\n]/.test(s) ? splitOn(s, /[|;\n]/) : splitOn(s, /,/));
const YES = new Set(["yes", "y", "true", "1", "x", "tick", "✓", "✔"]);
const NO = new Set(["no", "n", "false", "0"]);

type CatRow = { id: number; name: string; slug: string };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function buildPlan(grid: GridRow[]): Plan {
  if (!grid.length) throw new ImportError("The file is empty.");
  const [head, ...rawData] = grid;
  const colOf = new Map<string, number>();
  const ignored: string[] = [];
  head.cells.forEach((h, i) => {
    if (!h) return;
    const c = ALL_COLS.find((c) => c.aliases.includes(norm(h)));
    if (c && !colOf.has(c.key)) colOf.set(c.key, i);
    else if (!SILENT_COLUMNS.has(norm(h))) ignored.push(h);
  });
  const missing = ["name", "category"].filter((k) => !colOf.has(k)).map(labelOf);
  if (missing.length) throw new ImportError(`The first row must hold the column headings, including ${missing.join(" and ")}. Found: ${head.cells.filter(Boolean).join(", ") || "nothing"}. Download the template from the Import page and copy your products into it.`);
  const data = rawData.filter((r) => !(r.cells[colOf.get("name")!] ?? "").startsWith(HINT_MARK)); // the grey help line is not data
  if (data.length > IMPORT_MAX_ROWS) throw new ImportError(`This file has ${data.length} rows. Import up to ${IMPORT_MAX_ROWS} products at a time (split the file in parts).`);

  const categories = db.prepare("SELECT id, name, slug FROM categories ORDER BY sort_order, id").all() as CatRow[];
  const catBy = new Map<string, CatRow>();
  for (const c of categories) { catBy.set(norm(c.name), c); catBy.set(norm(c.slug), c); }
  const catNames = categories.map((c) => c.name);
  const industryBy = new Map<string, string>();
  for (const i of INDUSTRIES) { industryBy.set(norm(i.name), i.slug); industryBy.set(norm(i.slug), i.slug); }
  const industryNames = INDUSTRIES.map((i) => i.name);

  const existing = db.prepare("SELECT id, code, name, deleted_at FROM products").all() as { id: number; code: string; name: string; deleted_at: string | null }[];
  const byCode = new Map<string, (typeof existing)[number]>();
  const byName = new Map<string, (typeof existing)[number]>();
  let maxNo = 0;
  for (const p of existing) {
    if (p.code.trim()) byCode.set(p.code.trim().toLowerCase(), p);
    if (!p.deleted_at) byName.set(p.name.trim().toLowerCase(), p);
    maxNo = Math.max(maxNo, Number(/^AFS-(\d+)$/i.exec(p.code.trim())?.[1] ?? 0));
  }
  const get = (cells: string[], k: string) => (colOf.has(k) ? (cells[colOf.get(k)!] ?? "").trim() : "");
  // Codes typed in the file count too, so an automatic number never collides with one of them.
  for (const r of data) maxNo = Math.max(maxNo, Number(/^AFS-(\d+)$/i.exec(get(r.cells, "code"))?.[1] ?? 0));

  const seenCodes = new Map<string, number>();
  const seenNewNames = new Map<string, number>(); // names of products this file will add, to spot the same product typed twice
  const rows: RowPlan[] = [];

  for (const r of data) {
    const c = r.cells;
    const name = get(c, "name");
    const plan: RowPlan = { row: r.n, action: "error", name, category: get(c, "category"), code: get(c, "code"), codeAuto: false, status: "", changes: [], summary: "", errors: [], warnings: [], cells: c };
    rows.push(plan);
    /** Records a mistake against the cell of column `key` (or its fallback column). */
    const bad = (key: string, message: string, value = "") => {
      const col = colOf.get(key) ?? colOf.get("name") ?? 0;
      plan.errors.push({ column: head.cells[col] || labelOf(key), cell: `${letters(col)}${r.n}`, message, value, col });
    };
    const tooLong = (key: string, label: string, v: string, max: number) => { if (v.length > max) bad(key, `${label} is ${v.length} characters long, but the limit is ${max}. Please shorten it by ${v.length - max}.`, v.slice(0, 40) + "..."); };

    if (name === "Example product (delete this row)") { plan.action = "skipped"; plan.warnings.push("This is the example row from the template, so it is ignored."); continue; }

    // ---- required
    if (!name) bad("name", "The name is empty. Every product needs a name.");
    else if (name.length < 2) bad("name", "The name is too short (at least 2 characters).", name);
    else tooLong("name", "The name", name, 150);
    const cat = catBy.get(norm(plan.category));
    if (!plan.category) bad("category", "The category is empty. Pick one from the drop-down list in this cell.");
    else if (!cat) bad("category", `"${plan.category}" is not one of your categories.${didYouMean(plan.category, catNames, "Pick one from the drop-down list in this cell.")}`, plan.category);

    // ---- text
    const short = get(c, "shortDescription");
    const full = get(c, "fullDescription");
    tooLong("shortDescription", "The short description", short, 300);
    tooLong("fullDescription", "The full description", full, 5000);
    tooLong("code", "The code", plan.code, 40);

    // ---- specifications: pairs of cells (name, value); a single "Label: value | Label: value" cell is still understood
    const pairs: { k: number; label: string; value: string }[] = [];
    for (let k = 1; k <= SPEC_PAIRS; k++) {
      const ln = get(c, `spec${k}Name`);
      const lv = get(c, `spec${k}Value`);
      if (!ln && !lv) continue;
      if (ln && !lv) { bad(`spec${k}Value`, `Spec ${k} has the name "${ln}" but no value. Type its value (for example 10 mm), or clear the name.`, ln); continue; }
      if (!ln && lv) { bad(`spec${k}Name`, `Spec ${k} has the value "${lv}" but no name. Type what it is (for example Size), or clear the value.`, lv); continue; }
      if (ln.length > 80) { bad(`spec${k}Name`, `Spec ${k} name is ${ln.length} characters long (limit 80). Please shorten it.`, ln.slice(0, 40) + "..."); continue; }
      if (lv.length > 200) { bad(`spec${k}Value`, `Spec ${k} value is ${lv.length} characters long (limit 200). Please shorten it.`, lv.slice(0, 40) + "..."); continue; }
      pairs.push({ k, label: ln, value: lv });
    }
    let legacySpecs: { label: string; value: string }[] | null = null;
    const specRaw = get(c, "specifications");
    if (specRaw) {
      legacySpecs = [];
      for (const part of splitOn(specRaw, /[|\n]/)) {
        const i = part.indexOf(":");
        const label = i > 0 ? part.slice(0, i).trim() : "";
        const value = i > 0 ? part.slice(i + 1).trim() : "";
        if (!label || !value) { bad("specifications", `"${part.slice(0, 40)}" must look like Name: value (for example Size: 10 mm). Separate several with |.`, part.slice(0, 40)); break; }
        if (label.length > 80 || value.length > 200) { bad("specifications", `"${label.slice(0, 30)}" is too long.`, part.slice(0, 40)); break; }
        legacySpecs.push({ label, value });
      }
    }

    // ---- applications
    const apps = splitApplications(get(c, "applications"));
    if (apps.length > 50) bad("applications", "There are more than 50 applications. Keep the most important 50.");
    else if (apps.some((a) => a.length > 200)) bad("applications", "One application is longer than 200 characters. Please shorten it.");

    // ---- industries: one Yes/No column each (a single "Industries" cell is still understood)
    const yesInd: string[] = [];
    const noInd: string[] = [];
    for (const i of INDUSTRIES) {
      const key = `ind:${i.slug}`;
      const v = get(c, key);
      if (!v) continue;
      const n = norm(v);
      if (YES.has(n)) yesInd.push(i.slug);
      else if (NO.has(n)) noInd.push(i.slug);
      else bad(key, `"${v}" is not valid here. Choose Yes from the drop-down, or leave the cell empty.`, v);
    }
    let legacyInd: string[] | null = null;
    const indRaw = get(c, "industries");
    if (indRaw) {
      legacyInd = [];
      for (const i of splitOn(indRaw, /[|;,\n]/)) {
        const slug = industryBy.get(norm(i));
        if (!slug) { bad("industries", `"${i}" is not one of the industries.${didYouMean(i, industryNames, `Use: ${industryNames.join(", ")}.`)}`, i); break; }
        if (!legacyInd.includes(slug)) legacyInd.push(slug);
      }
    }

    // ---- status
    const stRaw = get(c, "status");
    let status: "draft" | "published" | "" = "";
    if (stRaw) {
      const s = norm(stRaw);
      if (["published", "publish", "live", "yes"].includes(s)) status = "published";
      else if (["draft", "hidden", "unpublished", "no"].includes(s)) status = "draft";
      else bad("status", `"${stRaw}" is not a valid status.${didYouMean(stRaw, ["Draft", "Published"], "Choose Draft or Published from the drop-down.")}`, stRaw);
    }

    // ---- new or update? (matched by Code)
    const key = plan.code.toLowerCase();
    let match: (typeof existing)[number] | undefined;
    if (plan.code) {
      const prev = seenCodes.get(key);
      if (prev) bad("code", `The code ${plan.code} was already used in row ${prev} of this file. Each product needs its own code (or leave it empty).`, plan.code);
      else seenCodes.set(key, r.n);
      match = byCode.get(key);
      if (match?.deleted_at) bad("code", `The code ${plan.code} belongs to a product in the Deleted tab. Restore it there (or delete it forever), then upload again.`, plan.code);
    }

    if (plan.errors.length) continue;

    // ---- build the product
    if (match) {
      const cur = getProductById(match.id);
      if (!cur) { bad("code", "The matching product could not be loaded. Please try again."); continue; }
      // Specifications by position: pair k replaces (or adds) spec k; empty pairs and anything not mentioned stay as they are.
      let specs = cur.specifications.map((s) => ({ ...s }));
      if (legacySpecs && legacySpecs.length) specs = legacySpecs;
      for (const p of pairs) {
        const entry = { label: p.label, value: p.value };
        if (p.k - 1 < specs.length) specs[p.k - 1] = entry; else specs.push(entry);
      }
      let industries = [...cur.industries];
      if (legacyInd && legacyInd.length) industries = legacyInd;
      for (const s of yesInd) if (!industries.includes(s)) industries.push(s);
      industries = industries.filter((s) => !noInd.includes(s));
      const next: ProductInput = {
        name, slug: cur.slug, code: cur.code, categoryId: cat!.id,
        shortDescription: short || cur.shortDescription, fullDescription: full || cur.fullDescription,
        specifications: specs, applications: apps.length ? apps : cur.applications, industries,
        compatibility: cur.compatibility, variants: cur.variants, documents: cur.documents, images: cur.images,
        featured: cur.featured, status: status || cur.status, seoTitle: cur.seoTitle, seoDescription: cur.seoDescription, sortOrder: cur.sortOrder ?? 0,
      };
      const diff: [string, boolean][] = [
        ["Name", next.name !== cur.name], ["Category", next.categoryId !== cur.categoryId],
        ["Short description", next.shortDescription !== cur.shortDescription], ["Full description", next.fullDescription !== cur.fullDescription],
        ["Specifications", !same(next.specifications, cur.specifications)],
        ["Applications", !same(next.applications, cur.applications)],
        ["Industries", !same([...next.industries].sort(), [...cur.industries].sort())],
        ["Status", next.status !== cur.status],
      ];
      plan.changes = diff.filter(([, d]) => d).map(([l]) => l);
      plan.id = match.id;
      plan.code = cur.code;
      plan.status = next.status;
      plan.input = next;
      plan.action = plan.changes.length ? "update" : "unchanged";
    } else {
      if (!plan.code) { plan.code = `AFS-${String(++maxNo).padStart(3, "0")}`; plan.codeAuto = true; }
      plan.status = status || "draft";
      const specs = legacySpecs && legacySpecs.length ? legacySpecs : pairs.map(({ label, value }) => ({ label, value }));
      const industries = [...new Set([...(legacyInd ?? []), ...yesInd])].filter((s) => !noInd.includes(s));
      plan.input = {
        name, slug: "", code: plan.code, categoryId: cat!.id, shortDescription: short, fullDescription: full,
        specifications: specs, applications: apps, industries, compatibility: [], variants: [], documents: [], images: [],
        featured: false, status: plan.status as "draft" | "published", seoTitle: "", seoDescription: "", sortOrder: 0,
      };
      plan.action = "new";
      plan.summary = [plan.status === "published" ? "Published" : "Draft", specs.length ? `${specs.length} specification${specs.length === 1 ? "" : "s"}` : "", industries.length ? `${industries.length} industr${industries.length === 1 ? "y" : "ies"}` : ""].filter(Boolean).join(" · ");
      const dup = byName.get(name.toLowerCase());
      const earlier = seenNewNames.get(name.toLowerCase());
      if (earlier) plan.warnings.push(`Row ${earlier} of this file has the same name ("${name}"). Both rows will be added as separate products. If this is a mistake, delete one of the rows.`);
      else seenNewNames.set(name.toLowerCase(), r.n);
      if (dup) plan.warnings.push(`You already have a product called "${dup.name}" (${dup.code || "no code"}). This row will create a second one. To change the existing product instead, type its code (${dup.code || "see Products"}) in the Code cell.`);
    }

    // ---- last line of defence: the same rules the product form uses
    const check = productSchema.safeParse(plan.input);
    if (!check.success) {
      plan.action = "error";
      const field = String(check.error.issues[0]?.path[0] ?? "name");
      bad(field, `${check.error.issues[0]?.message ?? "Invalid value"}`);
    }
  }

  const count = (a: RowPlan["action"]) => rows.filter((r) => r.action === a).length;
  return {
    rows, header: head.cells, colIndex: Object.fromEntries(colOf), ignoredColumns: ignored,
    summary: {
      total: rows.length, created: count("new"), updated: count("update"), unchanged: count("unchanged"), errors: count("error"), skipped: count("skipped"),
      newWithoutIndustries: rows.filter((r) => r.action === "new" && !r.input?.industries.length).length,
    },
  };
}

/** Saves every new/update row in ONE transaction: either all good rows are saved or none (e.g. on a database error). */
export function applyPlan(plan: Plan): { created: number; updated: number } {
  let created = 0;
  let updated = 0;
  db.transaction(() => {
    for (const r of plan.rows) {
      if (r.action === "new" && r.input) { createProduct(r.input); created++; }
      else if (r.action === "update" && r.input && r.id) { updateProduct(r.id, r.input); updated++; }
    }
  })();
  return { created, updated };
}

/** What the browser sees: the plan without the internal product objects and raw cells. */
export const publicPlan = (p: Plan) => ({
  summary: p.summary,
  ignoredColumns: p.ignoredColumns,
  rows: p.rows.map(({ input: _i, id: _id, cells: _c, ...rest }) => rest),
});

// ---------------------------------------------------------------------------
// Workbooks: the template, "my current products", and the "rows to fix" file
// ---------------------------------------------------------------------------

const FILL: Record<Group, string> = { required: "FF8F7240", basic: "FF172B29", spec: "FF2F5D57", industry: "FF475569" };

/** Adds the "Lists" sheet (what the drop-downs read from) and returns the ranges. */
function addLists(wb: ExcelJS.Workbook) {
  const categories = db.prepare("SELECT name FROM categories ORDER BY sort_order, id").all() as { name: string }[];
  const ref = wb.addWorksheet("Lists");
  ref.columns = [{ header: "Categories", width: 44 }, { header: "Status", width: 14 }];
  categories.forEach((c, i) => (ref.getCell(i + 2, 1).value = c.name));
  ref.getCell(2, 2).value = "Draft";
  ref.getCell(3, 2).value = "Published";
  ref.getRow(1).font = { bold: true };
  ref.getCell(1, 4).value = "These lists feed the drop-downs on the Products sheet. You do not need to change anything here.";
  ref.getCell(1, 4).font = { italic: true, color: { argb: "FF6B716E" } };
  return { categoryRange: categories.length ? `Lists!$A$2:$A$${categories.length + 1}` : "", statusRange: "Lists!$B$2:$B$3", categories };
}

type Validations = { add: (range: string, v: object) => void };
function addDropdowns(ws: ExcelJS.Worksheet, colIndex: Record<string, number>, from: number, to: number, lists: ReturnType<typeof addLists>) {
  const dv = (ws as unknown as { dataValidations: Validations }).dataValidations;
  const range = (key: string) => (colIndex[key] === undefined ? "" : `${letters(colIndex[key])}${from}:${letters(colIndex[key])}${to}`);
  if (lists.categoryRange && range("category")) dv.add(range("category"), { type: "list", allowBlank: true, formulae: [lists.categoryRange], showErrorMessage: true, errorTitle: "Category", error: "Please pick a category from the list (click the arrow on the right of the cell)." });
  if (range("status")) dv.add(range("status"), { type: "list", allowBlank: true, formulae: [lists.statusRange], showErrorMessage: true, errorTitle: "Status", error: "Choose Draft or Published." });
  for (const i of INDUSTRIES) { const r = range(`ind:${i.slug}`); if (r) dv.add(r, { type: "list", allowBlank: true, formulae: ['"Yes,No"'], showErrorMessage: true, errorTitle: "Yes or No", error: "Choose Yes, or leave the cell empty." }); }
  const len = (key: string, max: number, label: string, min = 0) => { const r = range(key); if (r) dv.add(r, { type: "textLength", operator: min ? "between" : "lessThanOrEqual", allowBlank: true, formulae: min ? [min, max] : [max], showErrorMessage: true, errorTitle: label, error: `${label} must be ${min ? `${min} to ${max}` : `at most ${max}`} characters.` }); };
  len("name", 150, "Name", 2);
  len("shortDescription", 300, "Short description");
  len("fullDescription", 5000, "Full description");
  len("code", 40, "Code");
}

export async function buildTemplate(withProducts = false): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agra Food Solutions";
  const start = wb.addWorksheet("Start here", { views: [{ showGridLines: false }] });
  const ws = wb.addWorksheet("Products", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
  const lists = addLists(wb);

  // ---- Products sheet
  ws.columns = COLS.map((c) => ({ key: c.key, width: c.width }));
  const head = ws.getRow(1);
  COLS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: "FFF4F0E8" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL[c.group] } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  head.height = 26;
  const hint = ws.getRow(2);
  COLS.forEach((c, i) => {
    const cell = hint.getCell(i + 1);
    cell.value = c.hint;
    cell.font = { italic: true, size: 9, color: { argb: "FF6B716E" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2EFE6" } };
    cell.alignment = { vertical: "top", wrapText: true };
  });
  hint.height = 48;

  let nextRow = 3;
  if (withProducts) {
    for (const p of listProducts(false)) {
      const v: Record<string, string> = {
        name: p.name, category: p.categoryName, code: p.code, shortDescription: p.shortDescription, fullDescription: p.fullDescription,
        status: p.status === "published" ? "Published" : "Draft",
        // Plain commas read best; use | instead when an entry itself contains a comma, so it survives a round trip.
        applications: p.applications.some((a) => a.includes(",")) ? p.applications.join(" | ") : p.applications.join(", "),
      };
      p.specifications.slice(0, SPEC_PAIRS).forEach((s, i) => { v[`spec${i + 1}Name`] = s.label; v[`spec${i + 1}Value`] = s.value; });
      for (const slug of p.industries) v[`ind:${slug}`] = "Yes";
      const row = ws.getRow(nextRow++);
      COLS.forEach((c, i) => { if (v[c.key]) row.getCell(i + 1).value = v[c.key]; });
    }
  } else {
    const ex: Record<string, string> = {
      name: "Example product (delete this row)", category: lists.categories[0]?.name ?? "", shortDescription: "One line shown on the product card.",
      fullDescription: "A longer description for the product page.", status: "Draft", spec1Name: "Size", spec1Value: "16 to 50 mm", spec2Name: "Material", spec2Value: "Rubber",
      applications: "Plansifter, Roller mill", [`ind:${INDUSTRIES[0].slug}`]: "Yes", [`ind:${INDUSTRIES[1].slug}`]: "Yes",
    };
    const row = ws.getRow(nextRow++);
    COLS.forEach((c, i) => { if (ex[c.key]) row.getCell(i + 1).value = ex[c.key]; });
    row.font = { italic: true, color: { argb: "FF8A8F8C" } };
  }
  const colIndex = Object.fromEntries(COLS.map((c, i) => [c.key, i]));
  addDropdowns(ws, colIndex, 3, 1002, lists);
  ws.eachRow({ includeEmpty: false }, (row, n) => { if (n > 2) row.eachCell((cell) => { cell.alignment = { vertical: "top", wrapText: true }; }); });

  // ---- Start here sheet (plain language)
  start.getColumn(1).width = 5;
  start.getColumn(2).width = 110;
  const add = (a: string, b: string, style?: { bold?: boolean; size?: number; color?: string; gap?: boolean }) => {
    const r = start.addRow([a, b]);
    r.getCell(1).font = { bold: true, size: 13, color: { argb: "FF8F7240" } };
    r.getCell(1).alignment = { vertical: "top" };
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    r.getCell(2).font = { bold: !!style?.bold, size: style?.size ?? 11, color: { argb: style?.color ?? "FF252B29" } };
    if (style?.gap) r.height = 10;
    return r;
  };
  add("", "Add many products at once", { bold: true, size: 20, color: "FF172B29" });
  add("", "Follow these steps. It takes a few minutes.", { color: "FF6B716E" });
  add("", "", { gap: true });
  add("1", withProducts
    ? "This file already contains your current products. Change what you need on the \"Products\" tab (at the bottom of the window), and add new products in the empty rows below."
    : "Click the \"Products\" tab at the bottom of the window.");
  add("2", "Type one product per row. Only the two BROWN columns are required: Name and Category.");
  add("3", "Category, Status and the \"Used in\" columns have a drop-down: click the cell, then the small arrow on its right.");
  add("4", "Leave Code EMPTY for a new product. The next AFS number is given automatically.");
  add("5", withProducts ? "Cells you leave empty are never erased: only what you type is changed." : "Delete the grey example row (or leave it, it is ignored).");
  add("6", "Save the file (as Excel .xlsx or CSV). In the admin, go to Products > Import and choose your file.");
  add("7", "You will see a preview that checks every row and tells you exactly which cell to correct. Nothing is saved until you click Confirm import.");
  add("", "", { gap: true });
  add("", "Good to know", { bold: true, size: 14, color: "FF172B29" });
  add("", "Specifications: type the name in the left cell and its value in the right cell (for example Size and 16 to 50 mm). Up to 5 per product here; more can be added in the product editor.");
  add("", "Applications: separate with commas, for example Plansifter, Roller mill.");
  add("", "Used in: choose Yes under each industry where the product is used. Leave empty if not.");
  add("", "Status: Draft keeps the product hidden from the website. Published makes it live. Empty means Draft.");
  add("", "Photos cannot be added in a spreadsheet. Add them afterwards in the product editor, then publish.");
  add("", "Changing existing products: in the admin choose \"Download my current products\", edit that file and upload it again.");
  add("", "", { gap: true });
  add("", "Colour guide:  brown heading = required   ·   green = optional   ·   teal = specifications   ·   grey-blue = industries", { color: "FF6B716E" });
  start.getCell("A1").font = { size: 1 };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** The rows with problems, in the person's own column order, with every bad cell highlighted and a plain note in front of each row. */
export async function buildProblemsFile(plan: Plan): Promise<Buffer> {
  const bad = plan.rows.filter((r) => r.action === "error");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agra Food Solutions";
  const ws = wb.addWorksheet("Fix these rows", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const lists = addLists(wb);
  const headerCells = plan.header.map((h) => h);
  ws.getColumn(1).width = 58;
  headerCells.forEach((_, i) => (ws.getColumn(i + 2).width = Math.max(14, Math.min(40, (headerCells[i].length || 8) + 6))));
  const h = ws.getRow(1);
  h.getCell(1).value = "What to fix";
  [...headerCells].forEach((t, i) => (h.getCell(i + 2).value = t));
  h.eachCell((cell, n) => {
    cell.font = { bold: true, color: { argb: "FFF4F0E8" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: n === 1 ? "FFB91C1C" : "FF172B29" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  h.height = 24;
  bad.forEach((r, i) => {
    const row = ws.getRow(i + 2);
    row.getCell(1).value = `Row ${r.row} of your file\n` + r.errors.map((e) => `• ${e.column}: ${e.message}`).join("\n");
    row.getCell(1).font = { color: { argb: "FFB91C1C" } };
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    headerCells.forEach((_, c) => {
      const cell = row.getCell(c + 2);
      cell.value = r.cells[c] ?? "";
      cell.alignment = { wrapText: true, vertical: "top" };
    });
    for (const e of r.errors) {
      const cell = row.getCell(e.col + 2);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } };
      cell.font = { bold: true, color: { argb: "FF991B1B" } };
    }
  });
  // same drop-downs as the template, shifted one column to the right because of the "What to fix" column
  const shifted = Object.fromEntries(Object.entries(plan.colIndex).map(([k, v]) => [k, v + 1]));
  addDropdowns(ws, shifted, 2, bad.length + 200, lists);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
