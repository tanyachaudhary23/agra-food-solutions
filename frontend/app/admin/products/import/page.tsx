"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { adminDownload, adminDownloadForm, adminFetch } from "@/lib/admin";
import { BusyLabel, Card, Notice, PageTitle, useToast } from "@/components/admin/ui";

type Action = "new" | "update" | "unchanged" | "error" | "skipped";
/** One mistake, pointing at the exact cell (for example B5). */
type Problem = { column: string; cell: string; message: string; value: string; col: number };
type Row = { row: number; action: Action; name: string; category: string; code: string; codeAuto: boolean; status: string; changes: string[]; summary: string; errors: Problem[]; warnings: string[] };
type Plan = {
  rows: Row[];
  ignoredColumns: string[];
  summary: { total: number; created: number; updated: number; unchanged: number; errors: number; skipped: number; newWithoutIndustries: number };
};
type Done = { created: number; updated: number; skipped: number; errors: number };

const BADGE: Record<Action, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-brass text-forest" },
  update: { label: "Update", cls: "bg-forest text-ivory" },
  unchanged: { label: "No changes", cls: "bg-grey-industrial text-forest" },
  error: { label: "Fix this", cls: "bg-red-800 text-white" },
  skipped: { label: "Ignored", cls: "bg-grey-industrial text-charcoal/70" },
};
const FIRST_SHOWN = 8;

export default function ImportProducts() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [filter, setFilter] = useState<"all" | Action>("all");
  const [busy, setBusy] = useState<"" | "preview" | "confirm" | "fix">("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [doneFile, setDoneFile] = useState<File | null>(null); // kept so the rows that were skipped can still be downloaded
  const [showAll, setShowAll] = useState(false);

  function pick(f: File | null) {
    setFile(f); setPlan(null); setErr(""); setDone(null); setDoneFile(null); setFilter("all"); setShowAll(false); // a different file means the old preview no longer applies
  }
  const form = (f: File) => { const fd = new FormData(); fd.append("file", f); return fd; };

  async function preview() {
    if (!file) return;
    setBusy("preview"); setErr(""); setDone(null); setDoneFile(null); setShowAll(false);
    try { setPlan(await adminFetch<Plan>("/products/import/preview", { method: "POST", form: form(file) })); setFilter("all"); }
    catch (e) { setPlan(null); setErr((e as Error).message); }
    finally { setBusy(""); }
  }
  async function confirmImport() {
    if (!file || !plan) return;
    setBusy("confirm"); setErr("");
    try {
      const r = await adminFetch<{ created: number; updated: number; skipped: number; summary: Plan["summary"] }>("/products/import/confirm", { method: "POST", form: form(file) });
      setDone({ created: r.created, updated: r.updated, skipped: r.skipped, errors: r.summary.errors });
      setDoneFile(r.summary.errors ? file : null);
      toast.success(`Imported: ${r.created} new, ${r.updated} updated.`);
      setPlan(null); setFile(null); if (input.current) input.current.value = "";
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(""); }
  }
  async function downloadFixes(f: File | null) {
    if (!f) return;
    setBusy("fix"); setErr("");
    try { await adminDownloadForm("/products/import/problems", form(f), "rows-to-fix.xlsx"); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(""); }
  }

  const shown = useMemo(() => (plan?.rows ?? []).filter((r) => filter === "all" || r.action === filter), [plan, filter]);
  const badRows = useMemo(() => (plan?.rows ?? []).filter((r) => r.action === "error"), [plan]);
  const s = plan?.summary;
  const importable = (s?.created ?? 0) + (s?.updated ?? 0);

  return (
    <>
      <PageTitle title="Import products">
        <Link href="/admin/products" className="btn btn-outline py-2">Back to products</Link>
      </PageTitle>
      <Notice kind="error">{err}</Notice>

      {done && (
        <div className="mb-4 border border-forest/20 bg-white p-4 text-sm" role="status">
          <p className="font-semibold text-forest">Done: {done.created} new product(s) added, {done.updated} updated.</p>
          <p className="mt-1 text-charcoal/70">New products are Drafts (hidden from the website) unless the sheet said Published. Add photos in the product editor, then publish.</p>
          {done.errors > 0 && doneFile && (
            <div className="mt-3 border-t border-forest/10 pt-3">
              <p className="text-red-800"><strong>{done.errors} row(s) were NOT imported</strong> because of mistakes. Download just those rows, fix the red cells, and upload that file.</p>
              <button className="btn btn-outline mt-2 py-2" disabled={busy !== ""} onClick={() => downloadFixes(doneFile)}><BusyLabel busy={busy === "fix"} busyText="Preparing…">Download the rows to fix</BusyLabel></button>
            </div>
          )}
          <Link href="/admin/products" className="mt-3 inline-block font-semibold text-forest underline">View products</Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1. Get the Excel file">
          <p className="text-sm text-charcoal/80">Open the file, click the <strong>Products</strong> tab, and type one product per row. A grey line under each heading tells you what to type, and the cells with a small arrow give you a list to choose from.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-charcoal/80">
            <li>Only <strong>Name</strong> and <strong>Category</strong> are required.</li>
            <li>Leave <strong>Code</strong> empty for a new product: it is numbered automatically.</li>
            <li>New products stay <strong>Draft</strong> (hidden) until you publish them.</li>
            <li>Photos are added afterwards, in the product editor.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-forest py-2" onClick={() => adminDownload("/products/import/template.xlsx", "product-import-template.xlsx").catch((e) => setErr(e.message))}>Download empty template</button>
            <button className="btn btn-outline py-2" onClick={() => adminDownload("/products/import/current.xlsx", "my-current-products.xlsx").catch((e) => setErr(e.message))}>Download my current products</button>
          </div>
          <p className="mt-2 text-xs text-charcoal/60">To change products you already have, use &ldquo;my current products&rdquo;: edit the file and upload it. Empty cells never erase anything.</p>
        </Card>

        <Card title="2. Upload and check">
          <p className="text-sm text-charcoal/80">Choose your finished file (Excel .xlsx or CSV, up to 1000 rows). The next screen checks every row and shows exactly which cell to correct. <strong>Nothing is saved until you click Confirm import.</strong></p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Spreadsheet file" className="field max-w-xs text-sm" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            <button className="btn btn-forest py-2" disabled={!file || busy !== ""} onClick={preview}><BusyLabel busy={busy === "preview"} busyText="Checking…">Check my file</BusyLabel></button>
          </div>
        </Card>
      </div>

      {plan && s && (
        <div className="mt-6 space-y-4">
          {/* the verdict, in plain words */}
          {s.errors === 0 ? (
            <div className="border border-forest/20 bg-white p-4 text-sm" role="status">
              <p className="font-semibold text-forest">Everything looks good{importable ? `: ${s.created} new, ${s.updated} to update.` : "."}</p>
              {importable === 0 && <p className="mt-1 text-charcoal/70">There is nothing to import: no new products and no changes were found in the file.</p>}
            </div>
          ) : (
            <div className="border border-red-800/30 bg-red-50 p-4 text-sm" role="alert">
              <p className="font-semibold text-red-800">{s.errors} row{s.errors === 1 ? " has" : "s have"} a mistake{importable ? ` and will be skipped. The other ${importable} row${importable === 1 ? " is" : "s are"} fine.` : ". Nothing can be imported yet."}</p>
              <p className="mt-1 text-charcoal/80">Each mistake below names the exact cell (for example <strong>B5</strong> = column B, row 5 of your file). Fix it in your file and check again, or download just the rows to fix, already highlighted in red.</p>
              <button className="btn btn-outline mt-3 py-2" disabled={busy !== ""} onClick={() => downloadFixes(file)}><BusyLabel busy={busy === "fix"} busyText="Preparing…">Download the rows to fix</BusyLabel></button>

              <ul className="mt-4 space-y-3">
                {(showAll ? badRows : badRows.slice(0, FIRST_SHOWN)).map((r) => (
                  <li key={r.row} className="border-l-4 border-red-800 bg-white p-3">
                    <p className="font-semibold">Row {r.row}{r.name ? <span className="font-normal text-charcoal/70"> · {r.name}</span> : null}</p>
                    <ul className="mt-1 space-y-1.5">
                      {r.errors.map((p, i) => (
                        <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="whitespace-nowrap bg-red-800 px-1.5 py-0.5 font-heading text-xs font-semibold text-white">Cell {p.cell}</span>
                          <span className="font-semibold">{p.column}:</span>
                          <span>{p.message}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {badRows.length > FIRST_SHOWN && !showAll && <button className="mt-3 font-semibold text-forest underline" onClick={() => setShowAll(true)}>Show all {badRows.length} rows with mistakes</button>}
            </div>
          )}

          {plan.ignoredColumns.length > 0 && <p className="text-sm text-charcoal/70">Columns that were not recognised and ignored: {plan.ignoredColumns.join(", ")}.</p>}
          {s.newWithoutIndustries > 0 && <p className="text-sm text-charcoal/70">{s.newWithoutIndustries} new product(s) have no &ldquo;Used in&rdquo; industry chosen, so they won&apos;t appear on the Industries page until tagged.</p>}

          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm" role="tablist" aria-label="Filter rows">
              {([["all", `All rows (${s.total})`], ["new", `New (${s.created})`], ["update", `Updates (${s.updated})`], ["unchanged", `No changes (${s.unchanged})`], ["error", `Fix this (${s.errors})`], ["skipped", `Ignored (${s.skipped})`]] as const)
                .filter(([k]) => k === "all" || (k === "new" ? s.created : k === "update" ? s.updated : k === "unchanged" ? s.unchanged : k === "error" ? s.errors : s.skipped) > 0)
                .map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`px-3 py-1.5 font-heading text-xs font-semibold ${filter === k ? "bg-forest text-ivory" : "border border-forest/20 bg-white text-forest hover:bg-ivory"}`}>{label}</button>
                ))}
            </div>

            <div className="mt-3 overflow-x-auto border border-forest/15 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-ivory font-heading text-xs uppercase tracking-wider text-forest">
                  <tr><th className="p-3">Row</th><th className="p-3">Result</th><th className="p-3">Name</th><th className="p-3">Category</th><th className="p-3">Code</th><th className="p-3">What will happen</th></tr>
                </thead>
                <tbody className="divide-y divide-forest/10">
                  {shown.map((r) => {
                    const badCols = new Set(r.errors.map((p) => p.column));
                    return (
                      <tr key={r.row} className={r.action === "error" ? "bg-red-50" : ""}>
                        <td className="p-3 text-charcoal/60">{r.row}</td>
                        <td className="p-3"><span className={`whitespace-nowrap px-2 py-0.5 font-heading text-xs font-semibold ${BADGE[r.action].cls}`}>{BADGE[r.action].label}</span></td>
                        <td className={`p-3 font-semibold ${badCols.has("Name") ? "text-red-800 underline decoration-wavy" : ""}`}>{r.name || <span className="text-charcoal/40">(empty)</span>}</td>
                        <td className={`p-3 ${badCols.has("Category") ? "text-red-800 underline decoration-wavy" : ""}`}>{r.category}</td>
                        <td className="p-3 whitespace-nowrap">{r.code ? <>{r.code}{r.codeAuto && <span className="ml-1 text-xs text-charcoal/60">(auto)</span>}</> : ""}</td>
                        <td className="p-3">
                          {r.errors.map((p, i) => <p key={i} className="text-red-800"><strong>Cell {p.cell}:</strong> {p.message}</p>)}
                          {r.action === "update" && <p>Will change: {r.changes.join(", ")}</p>}
                          {r.action === "new" && <p className="text-charcoal/70">Will be added{r.summary ? `: ${r.summary}` : ""}</p>}
                          {r.warnings.map((m, i) => <p key={i} className="text-charcoal/70">{r.action === "skipped" ? "" : "Note: "}{m}</p>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-forest py-2" disabled={importable === 0 || busy !== ""} onClick={confirmImport}>
              <BusyLabel busy={busy === "confirm"} busyText="Importing…">{s.errors ? `Import the ${importable} good row${importable === 1 ? "" : "s"} now` : `Confirm import (${s.created} new, ${s.updated} update${s.updated === 1 ? "" : "s"})`}</BusyLabel>
            </button>
            <button className="btn btn-outline py-2" disabled={busy !== ""} onClick={() => pick(null)}>Cancel</button>
            {importable === 0 && <span className="text-sm text-charcoal/70">Nothing to import yet.</span>}
            {s.errors > 0 && importable > 0 && <span className="text-sm text-charcoal/70">The {s.errors} row(s) with mistakes are skipped. You can fix and upload them afterwards.</span>}
          </div>
        </div>
      )}
    </>
  );
}
