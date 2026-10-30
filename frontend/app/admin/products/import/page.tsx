"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { adminDownload, adminDownloadForm, adminFetch } from "@/lib/admin";
import { ArrowLeft, Download, FileSpreadsheet, Upload } from "lucide-react";
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
  new: { label: "New", cls: "a-tag" },
  update: { label: "Update", cls: "a-tag !bg-[color:var(--a-brand)] !text-[#F4F0E8]" },
  unchanged: { label: "No changes", cls: "a-tag a-tag-quiet" },
  error: { label: "Fix this", cls: "a-tag !bg-[color:var(--a-danger)] !text-white" },
  skipped: { label: "Ignored", cls: "a-tag a-tag-quiet" },
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
      <PageTitle title="Import products" description="Add or update many products at once from an Excel or CSV file.">
        <Link href="/admin/products" className="a-btn a-btn-ghost"><ArrowLeft />Back to products</Link>
      </PageTitle>
      <Notice kind="error">{err}</Notice>

      {done && (
        <div className="a-panel a-fade mb-6 text-[14px]" role="status">
          <p className="font-heading text-[16px] font-bold">Done: {done.created} new product(s) added, {done.updated} updated.</p>
          <p className="mt-1 text-[color:var(--a-ink2)]">New products are Drafts (hidden from the website) unless the sheet said Published. Add photos in the product editor, then publish.</p>
          {done.errors > 0 && doneFile && (
            <div className="mt-4 border-t border-[color:var(--a-line)] pt-4">
              <p className="text-[color:var(--a-danger)]"><strong>{done.errors} row(s) were NOT imported</strong> because of mistakes. Download just those rows, fix the red cells, and upload that file.</p>
              <button className="a-btn a-btn-ghost mt-3" disabled={busy !== ""} onClick={() => downloadFixes(doneFile)}><BusyLabel busy={busy === "fix"} busyText="Preparing…">Download the rows to fix</BusyLabel></button>
            </div>
          )}
          <Link href="/admin/products" className="a-link mt-4 inline-block">View products</Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="1. Get the Excel file">
          <p className="text-[14px] text-[color:var(--a-ink2)]">Open the file, click the <strong>Products</strong> tab, and type one product per row. A grey line under each heading tells you what to type, and the cells with a small arrow give you a list to choose from.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px] text-[color:var(--a-ink2)]">
            <li>Only <strong>Name</strong> and <strong>Category</strong> are required.</li>
            <li>Leave <strong>Code</strong> empty for a new product: it is numbered automatically.</li>
            <li>New products stay <strong>Draft</strong> (hidden) until you publish them.</li>
            <li>Photos are added afterwards, in the product editor.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="a-btn a-btn-primary" onClick={() => adminDownload("/products/import/template.xlsx", "product-import-template.xlsx").catch((e) => setErr(e.message))}><FileSpreadsheet />Download empty template</button>
            <button className="a-btn a-btn-ghost" onClick={() => adminDownload("/products/import/current.xlsx", "my-current-products.xlsx").catch((e) => setErr(e.message))}><Download />Download my current products</button>
          </div>
          <p className="a-hint mt-3">To change products you already have, use &ldquo;my current products&rdquo;: edit the file and upload it. Empty cells never erase anything.</p>
        </Card>

        <Card title="2. Upload and check">
          <p className="text-[14px] text-[color:var(--a-ink2)]">Choose your finished file (Excel .xlsx or CSV, up to 1000 rows). The next screen checks every row and shows exactly which cell to correct. <strong>Nothing is saved until you click Confirm import.</strong></p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Spreadsheet file" className="a-input max-w-xs" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            <button className="a-btn a-btn-primary" disabled={!file || busy !== ""} onClick={preview}><BusyLabel busy={busy === "preview"} busyText="Checking…"><Upload />Check my file</BusyLabel></button>
          </div>
        </Card>
      </div>

      {plan && s && (
        <div className="mt-6 space-y-4">
          {/* the verdict, in plain words */}
          {s.errors === 0 ? (
            <div className="a-notice a-notice-success block" role="status">
              <p className="font-semibold">Everything looks good{importable ? `: ${s.created} new, ${s.updated} to update.` : "."}</p>
              {importable === 0 && <p className="mt-1 opacity-80">There is nothing to import: no new products and no changes were found in the file.</p>}
            </div>
          ) : (
            <div className="a-panel !border-[rgba(163,48,44,.25)] !bg-[color:var(--a-danger-soft)] text-[14px]" role="alert">
              <p className="font-heading text-[15px] font-bold text-[color:var(--a-danger)]">{s.errors} row{s.errors === 1 ? " has" : "s have"} a mistake{importable ? ` and will be skipped. The other ${importable} row${importable === 1 ? " is" : "s are"} fine.` : ". Nothing can be imported yet."}</p>
              <p className="mt-1.5 text-[color:var(--a-ink2)]">Each mistake below names the exact cell (for example <strong>B5</strong> = column B, row 5 of your file). Fix it in your file and check again, or download just the rows to fix, already highlighted in red.</p>
              <button className="a-btn a-btn-ghost mt-4" disabled={busy !== ""} onClick={() => downloadFixes(file)}><BusyLabel busy={busy === "fix"} busyText="Preparing…">Download the rows to fix</BusyLabel></button>

              <ul className="mt-4 space-y-3">
                {(showAll ? badRows : badRows.slice(0, FIRST_SHOWN)).map((r) => (
                  <li key={r.row} className="rounded-xl border-l-[3px] border-[color:var(--a-danger)] bg-white p-3.5">
                    <p className="font-semibold">Row {r.row}{r.name ? <span className="font-normal text-charcoal/70"> · {r.name}</span> : null}</p>
                    <ul className="mt-1 space-y-1.5">
                      {r.errors.map((p, i) => (
                        <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="a-tag !bg-[color:var(--a-danger)] !text-white">Cell {p.cell}</span>
                          <span className="font-semibold">{p.column}:</span>
                          <span>{p.message}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {badRows.length > FIRST_SHOWN && !showAll && <button className="a-link mt-3" onClick={() => setShowAll(true)}>Show all {badRows.length} rows with mistakes</button>}
            </div>
          )}

          {plan.ignoredColumns.length > 0 && <p className="text-[13.5px] text-[color:var(--a-ink2)]">Columns that were not recognised and ignored: {plan.ignoredColumns.join(", ")}.</p>}
          {s.newWithoutIndustries > 0 && <p className="text-[13.5px] text-[color:var(--a-ink2)]">{s.newWithoutIndustries} new product(s) have no &ldquo;Used in&rdquo; industry chosen, so they won&apos;t appear on the Industries page until tagged.</p>}

          <div>
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter rows">
              {([["all", `All rows (${s.total})`], ["new", `New (${s.created})`], ["update", `Updates (${s.updated})`], ["unchanged", `No changes (${s.unchanged})`], ["error", `Fix this (${s.errors})`], ["skipped", `Ignored (${s.skipped})`]] as const)
                .filter(([k]) => k === "all" || (k === "new" ? s.created : k === "update" ? s.updated : k === "unchanged" ? s.unchanged : k === "error" ? s.errors : s.skipped) > 0)
                .map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className="a-chip">{label}</button>
                ))}
            </div>

            <div className="a-table-wrap mt-3">
              <table className="a-table">
                <thead>
                  <tr><th className="p-3">Row</th><th className="p-3">Result</th><th className="p-3">Name</th><th className="p-3">Category</th><th className="p-3">Code</th><th className="p-3">What will happen</th></tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const badCols = new Set(r.errors.map((p) => p.column));
                    return (
                      <tr key={r.row} className={r.action === "error" ? "a-bad" : ""}>
                        <td className="text-[color:var(--a-ink3)]">{r.row}</td>
                        <td><span className={BADGE[r.action].cls}>{BADGE[r.action].label}</span></td>
                        <td className={`font-semibold ${badCols.has("Name") ? "text-[color:var(--a-danger)] underline decoration-wavy" : ""}`}>{r.name || <span className="text-charcoal/40">(empty)</span>}</td>
                        <td className={badCols.has("Category") ? "text-[color:var(--a-danger)] underline decoration-wavy" : ""}>{r.category}</td>
                        <td className="whitespace-nowrap">{r.code ? <>{r.code}{r.codeAuto && <span className="ml-1 text-xs text-charcoal/60">(auto)</span>}</> : ""}</td>
                        <td>
                          {r.errors.map((p, i) => <p key={i} className="text-[color:var(--a-danger)]"><strong>Cell {p.cell}:</strong> {p.message}</p>)}
                          {r.action === "update" && <p>Will change: {r.changes.join(", ")}</p>}
                          {r.action === "new" && <p className="text-[color:var(--a-ink2)]">Will be added{r.summary ? `: ${r.summary}` : ""}</p>}
                          {r.warnings.map((m, i) => <p key={i} className="text-[color:var(--a-ink2)]">{r.action === "skipped" ? "" : "Note: "}{m}</p>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="a-btn a-btn-primary" disabled={importable === 0 || busy !== ""} onClick={confirmImport}>
              <BusyLabel busy={busy === "confirm"} busyText="Importing…">{s.errors ? `Import the ${importable} good row${importable === 1 ? "" : "s"} now` : `Confirm import (${s.created} new, ${s.updated} update${s.updated === 1 ? "" : "s"})`}</BusyLabel>
            </button>
            <button className="a-btn a-btn-ghost" disabled={busy !== ""} onClick={() => pick(null)}>Cancel</button>
            {importable === 0 && <span className="text-[13.5px] text-[color:var(--a-ink2)]">Nothing to import yet.</span>}
            {s.errors > 0 && importable > 0 && <span className="text-[13.5px] text-[color:var(--a-ink2)]">The {s.errors} row(s) with mistakes are skipped. You can fix and upload them afterwards.</span>}
          </div>
        </div>
      )}
    </>
  );
}
