"use client";
import { useCallback, useEffect, useState } from "react";
import { adminDownload, adminFetch, STATUS_LABEL } from "@/lib/admin";
import { ListSkeleton, Notice, PageTitle, useConfirm, useToast } from "@/components/admin/ui";

type Enquiry = {
  id: number; number: number | null; createdAt: string; name: string; company: string; email: string; country: string; phone: string; product: string;
  quantity: string; requirements: string; message: string; attachmentName: string | null; hasAttachment: boolean;
  status: string; notes: string; emailStatus: string; emailError: string;
};
type List = { total: number; page: number; pages: number; items: Enquiry[] };

export default function Enquiries() {
  const [data, setData] = useState<List | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    adminFetch<List>(`/enquiries?${p}`).then(setData).catch((e) => setErr(e.message));
  }, [page, status, q]);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    if (s) setStatus(s);
  }, []);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function patch(id: number, body: { status?: string; notes?: string }) {
    try { await adminFetch(`/enquiries/${id}`, { method: "PATCH", body }); toast.success(body.status ? "Status updated." : "Note saved."); load(); } catch (e) { toast.error((e as Error).message); }
  }
  async function remove(id: number) {
    const ok = await confirm({ title: "Delete this enquiry?", body: "The enquiry and any attachment are removed permanently. Consider setting it to Closed instead.", confirmLabel: "Delete enquiry", danger: true });
    if (!ok) return;
    try { await adminFetch(`/enquiries/${id}`, { method: "DELETE" }); toast.success("Enquiry deleted."); setOpen(null); load(); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <PageTitle title="Enquiries">
        <button className="btn btn-outline py-2" onClick={() => adminDownload("/enquiries.csv", "enquiries.csv").catch((e) => setErr(e.message))}>Export CSV</button>
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-3">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name, company, country, product…" aria-label="Search enquiries" className="field max-w-sm" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status" className="field w-auto">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Notice kind="error">{err}</Notice>

      <div className="mt-4 border border-forest/15 bg-white">
        {!data ? <ListSkeleton rows={6} /> : data.items.length === 0 ? <p className="p-5 text-sm text-charcoal/70">No enquiries found.</p> : (
          <ul className="divide-y divide-forest/10">
            {data.items.map((e) => (
              <li key={e.id}>
                <button onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left text-sm transition-colors hover:bg-ivory">
                  <span><strong>#{e.number ?? e.id} {e.name}</strong>, {e.company} ({e.country}){e.product ? ` · ${e.product}` : ""}</span>
                  <span className="flex items-center gap-3 text-charcoal/60">
                    {e.emailStatus !== "sent" && <span className="text-red-800" title={e.emailError || "Email not sent"}>email {e.emailStatus === "not_configured" ? "not set up" : e.emailStatus}</span>}
                    {new Date(e.createdAt + "Z").toLocaleString()}
                    <span className={`px-2 py-0.5 font-heading text-xs font-semibold ${e.status === "new" ? "bg-brass text-forest" : "bg-grey-industrial text-forest"}`}>{STATUS_LABEL[e.status]}</span>
                  </span>
                </button>
                {open === e.id && (
                  <div className="admin-fade space-y-4 border-t border-forest/10 bg-ivory p-5 text-sm">
                    <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                      {([["Email", e.email], ["Phone", e.phone], ["Product / part", e.product], ["Quantity", e.quantity]] as const).map(([k, v]) => v ? (
                        <div key={k}><dt className="label !mb-0">{k}</dt><dd>{k === "Email" ? <a className="underline" href={`mailto:${v}`}>{v}</a> : v}</dd></div>
                      ) : null)}
                    </dl>
                    {e.requirements && <div><p className="label">Technical requirements</p><p className="whitespace-pre-wrap">{e.requirements}</p></div>}
                    <div><p className="label">Message</p><p className="whitespace-pre-wrap">{e.message}</p></div>
                    {e.hasAttachment && (
                      <button className="btn btn-outline py-2" onClick={() => adminDownload(`/enquiries/${e.id}/attachment`, e.attachmentName || "attachment").catch((x) => setErr(x.message))}>Download attachment: {e.attachmentName}</button>
                    )}
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
                      <a className="btn btn-forest py-2" href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: your enquiry${e.product ? ` about ${e.product}` : ""}`)}`}>Reply by email</a>
                      <button className="btn btn-outline py-2 !border-red-800 !text-red-800 hover:!bg-red-800 hover:!text-white" onClick={() => remove(e.id)}>Delete</button>
                    </div>
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
