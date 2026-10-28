"use client";
import { useCallback, useEffect, useState } from "react";
import { adminDownload, adminFetch, STATUS_LABEL } from "@/lib/admin";
import { ListSkeleton, Notice, PageTitle, useConfirm, useToast } from "@/components/admin/ui";

type Enquiry = {
  id: number; number: number | null; createdAt: string; name: string; company: string; email: string; country: string; phone: string; product: string;
  quantity: string; requirements: string; message: string; attachmentName: string | null; hasAttachment: boolean;
  status: string; notes: string; emailStatus: string; emailError: string;
  deletedAt: string | null; daysLeft: number | null;
};
type List = { total: number; page: number; pages: number; items: Enquiry[] };

export default function Enquiries() {
  const [data, setData] = useState<List | null>(null);
  const [view, setView] = useState<"active" | "deleted">("active");
  const [binCount, setBinCount] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (view === "deleted") p.set("view", "deleted");
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    adminFetch<List>(`/enquiries?${p}`).then(setData).catch((e) => setErr(e.message));
    adminFetch<{ deletedEnquiries: number }>("/stats").then((s) => setBinCount(s.deletedEnquiries)).catch(() => {});
  }, [page, status, q, view]);

  async function resend(id: number) {
    try {
      const r = await adminFetch<{ ok: boolean; emailStatus: string; emailError: string }>(`/enquiries/${id}/resend-email`, { method: "POST" });
      if (r.ok) toast.success("Notification email sent."); else toast.error(r.emailStatus === "not_configured" ? "Email is not set up on the server yet." : `Email failed: ${r.emailError || "unknown error"}`);
      load();
    } catch (x) { toast.error((x as Error).message); }
  }

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("status");
    if (s) setStatus(s);
    if (sp.get("view") === "deleted") setView("deleted");
  }, []);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function patch(id: number, body: { status?: string; notes?: string }) {
    try { await adminFetch(`/enquiries/${id}`, { method: "PATCH", body }); toast.success(body.status ? "Status updated." : "Note saved."); load(); } catch (e) { toast.error((e as Error).message); }
  }
  async function remove(id: number) {
    const ok = await confirm({ title: "Delete this enquiry?", body: "It moves to the Deleted tab and stays there for 30 days. You can restore it any time until then, after which it is removed for good.", confirmLabel: "Delete enquiry", danger: true });
    if (!ok) return;
    try { await adminFetch(`/enquiries/${id}`, { method: "DELETE" }); toast.success("Enquiry moved to Deleted. You can restore it for 30 days."); setOpen(null); load(); } catch (e) { toast.error((e as Error).message); }
  }
  async function restore(id: number) {
    try { await adminFetch(`/enquiries/${id}/restore`, { method: "POST" }); toast.success("Enquiry restored."); setOpen(null); load(); } catch (e) { toast.error((e as Error).message); }
  }
  async function removeForever(id: number) {
    const ok = await confirm({ title: "Delete forever?", body: "The enquiry and any attachment are removed permanently right now. This cannot be undone.", confirmLabel: "Delete forever", danger: true });
    if (!ok) return;
    try { await adminFetch(`/enquiries/${id}/permanent`, { method: "DELETE" }); toast.success("Enquiry deleted forever."); setOpen(null); load(); } catch (e) { toast.error((e as Error).message); }
  }
  function switchView(v: "active" | "deleted") { setView(v); setPage(1); setOpen(null); setData(null); setErr(""); }
  const inBin = view === "deleted";

  return (
    <>
      <PageTitle title="Enquiries">
        {!inBin && <button className="btn btn-outline py-2" onClick={() => adminDownload("/enquiries.csv", "enquiries.csv").catch((e) => setErr(e.message))}>Export CSV</button>}
      </PageTitle>
      <div role="tablist" aria-label="Enquiry list" className="mb-4 flex gap-1 border-b border-forest/15">
        {([["active", "Enquiries"], ["deleted", `Deleted${binCount ? ` (${binCount})` : ""}`]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => switchView(k)}
            className={`-mb-px border-b-2 px-4 py-2 font-heading text-sm font-semibold transition-colors ${view === k ? "border-brass text-forest" : "border-transparent text-charcoal/60 hover:text-forest"}`}>{label}</button>
        ))}
      </div>
      {inBin && <p className="mb-4 text-sm text-charcoal/70">Deleted enquiries stay here for 30 days, then are removed for good. Restore one to put it back in Enquiries.</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name, company, country, product…" aria-label="Search enquiries" className="field max-w-sm" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status" className="field w-auto">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Notice kind="error">{err}</Notice>

      <div className="mt-4 border border-forest/15 bg-white">
        {!data ? <ListSkeleton rows={6} /> : data.items.length === 0 ? <p className="p-5 text-sm text-charcoal/70">{inBin ? "Nothing in Deleted." : "No enquiries found."}</p> : (
          <ul className="divide-y divide-forest/10">
            {data.items.map((e) => (
              <li key={e.id}>
                <button onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left text-sm transition-colors hover:bg-ivory">
                  <span><strong>#{e.number ?? e.id} {e.name}</strong>, {e.company} ({e.country}){e.product ? ` · ${e.product.length > 70 ? e.product.slice(0, 67) + "…" : e.product}` : ""}</span>
                  <span className="flex items-center gap-3 text-charcoal/60">
                    {!inBin && e.emailStatus !== "sent" && <span className="text-red-800" title={e.emailError || "Email not sent"}>email {e.emailStatus === "not_configured" ? "not set up" : e.emailStatus}</span>}
                    {new Date(e.createdAt + "Z").toLocaleString()}
                    {inBin ? (
                      <span className={`px-2 py-0.5 font-heading text-xs font-semibold ${(e.daysLeft ?? 0) <= 3 ? "bg-red-800 text-white" : "bg-grey-industrial text-forest"}`}>
                        {e.daysLeft === 0 ? "Removed within 24 hours" : `${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"} left`}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 font-heading text-xs font-semibold ${e.status === "new" ? "bg-brass text-forest" : "bg-grey-industrial text-forest"}`}>{STATUS_LABEL[e.status]}</span>
                    )}
                  </span>
                </button>
                {open === e.id && (
                  <div className="admin-fade space-y-4 border-t border-forest/10 bg-ivory p-5 text-sm">
                    <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                      {([["Email", e.email], ["Phone", e.phone], ["Product / part", e.product], ["Quantity", e.quantity]] as const).map(([k, v]) => v ? (
                        <div key={k}><dt className="label !mb-0">{k}</dt><dd className="whitespace-pre-line break-words">{k === "Email" ? <a className="underline" href={`mailto:${v}`}>{v}</a> : v}</dd></div>
                      ) : null)}
                    </dl>
                    {e.requirements && <div><p className="label">Technical requirements</p><p className="whitespace-pre-wrap">{e.requirements}</p></div>}
                    <div><p className="label">Message</p><p className="whitespace-pre-wrap">{e.message}</p></div>
                    {e.hasAttachment && (
                      <button className="btn btn-outline py-2" onClick={() => adminDownload(`/enquiries/${e.id}/attachment`, e.attachmentName || "attachment").catch((x) => setErr(x.message))}>Download attachment: {e.attachmentName}</button>
                    )}
                    {inBin ? (
                      <>
                        {e.notes && <div><p className="label">Internal notes</p><p className="whitespace-pre-wrap">{e.notes}</p></div>}
                        <p className="text-charcoal/70">Deleted {e.deletedAt ? new Date(e.deletedAt + "Z").toLocaleString() : ""}. Status when deleted: {STATUS_LABEL[e.status]}.</p>
                        <div className="flex flex-wrap gap-3">
                          <button className="btn btn-forest py-2" onClick={() => restore(e.id)}>Restore</button>
                          <button className="btn btn-outline py-2 !border-red-800 !text-red-800 hover:!bg-red-800 hover:!text-white" onClick={() => removeForever(e.id)}>Delete forever</button>
                        </div>
                      </>
                    ) : (<>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label><span className="label">Status</span>
                        <select className="field" value={e.status} onChange={(ev) => patch(e.id, { status: ev.target.value })}>
                          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </label>
                      <label className="sm:col-span-2"><span className="label">Internal notes (not visible to the buyer)</span>
                        <textarea className="field" rows={2} defaultValue={e.notes} onBlur={(ev) => ev.target.value !== e.notes && patch(e.id, { notes: ev.target.value })} />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {e.emailStatus !== "sent" && (
                        <button className="btn btn-outline py-2" onClick={() => resend(e.id)}>Retry notification email</button>
                      )}
                      <a className="btn btn-forest py-2" href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: your enquiry${e.product ? ` about ${e.product}` : ""}`)}`}>Reply by email</a>
                      <button className="btn btn-outline py-2 !border-red-800 !text-red-800 hover:!bg-red-800 hover:!text-white" onClick={() => remove(e.id)}>Delete</button>
                    </div>
                    </>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button className="btn btn-outline py-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {data.page} of {data.pages} ({data.total} enquiries)</span>
          <button className="btn btn-outline py-2" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
