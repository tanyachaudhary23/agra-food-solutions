"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, Inbox, Mail, MailWarning, Paperclip, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { adminDownload, adminFetch, STATUS_LABEL, timeAgo } from "@/lib/admin";
import { BusyLabel, Drawer, EmptyState, ListSkeleton, Notice, PageTitle, useConfirm, useToast } from "@/components/admin/ui";

type Enquiry = {
  id: number; number: number | null; createdAt: string; name: string; company: string; email: string; country: string; phone: string; product: string;
  quantity: string; requirements: string; message: string; attachmentName: string | null; hasAttachment: boolean;
  status: string; notes: string; emailStatus: string; emailError: string;
  deletedAt: string | null; daysLeft: number | null;
};
type List = { total: number; page: number; pages: number; items: Enquiry[] };

const STATUS_CLASS: Record<string, string> = { new: "a-status-new", in_progress: "a-status-warn", quoted: "a-status-ok", closed: "a-status-muted" };
const emailLabel = (s: string) => (s === "not_configured" ? "Email not set up" : s === "failed" ? "Email failed" : `Email ${s}`);

export default function Enquiries() {
  const [data, setData] = useState<List | null>(null);
  const [view, setView] = useState<"active" | "deleted">("active");
  const [binCount, setBinCount] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [sel, setSel] = useState<Enquiry | null>(null); // kept so the panel stays readable while it slides away
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
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

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("status");
    if (s) setStatus(s);
    if (sp.get("view") === "deleted") setView("deleted");
  }, []);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  // keep the open panel in step with fresh data (for example after a status change)
  useEffect(() => {
    if (open === null || !data) return;
    const fresh = data.items.find((x) => x.id === open);
    if (fresh) setSel(fresh);
  }, [data, open]);

  function openEnquiry(e: Enquiry) { setSel(e); setNote(e.notes); setOpen(e.id); }
  const close = useCallback(() => setOpen(null), []);

  async function resend(id: number) {
    setBusy("resend");
    try {
      const r = await adminFetch<{ ok: boolean; emailStatus: string; emailError: string }>(`/enquiries/${id}/resend-email`, { method: "POST" });
      if (r.ok) toast.success("Notification email sent."); else toast.error(r.emailStatus === "not_configured" ? "Email is not set up on the server yet." : `Email failed: ${r.emailError || "unknown error"}`);
      load();
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(""); }
  }
  async function patch(id: number, body: { status?: string; notes?: string }) {
    if (body.status) setSel((s) => (s && s.id === id ? { ...s, status: body.status! } : s));
    try { await adminFetch(`/enquiries/${id}`, { method: "PATCH", body }); toast.success(body.status ? "Status updated." : "Note saved."); load(); } catch (e) { toast.error((e as Error).message); load(); }
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
  const e = sel;

  return (
    <>
      <PageTitle title="Enquiries" description={data ? `${data.total} ${inBin ? "deleted " : ""}enquir${data.total === 1 ? "y" : "ies"}${status ? ` · ${STATUS_LABEL[status]}` : ""}` : "Requests from buyers."}>
        {!inBin && <button className="a-btn a-btn-ghost" onClick={() => adminDownload("/enquiries.csv", "enquiries.csv").catch((x) => setErr(x.message))}><Download />Export CSV</button>}
      </PageTitle>

      <div role="tablist" aria-label="Enquiry list" className="a-tabs mb-6">
        {([["active", "Enquiries"], ["deleted", `Deleted${binCount ? ` (${binCount})` : ""}`]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => switchView(k)} className="a-tab">{label}</button>
        ))}
      </div>
      {inBin && <p className="mb-5 max-w-2xl text-[13.5px] text-[color:var(--a-ink2)]">Deleted enquiries stay here for 30 days, then are removed for good. Restore one to put it back in Enquiries.</p>}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="a-search min-w-[220px] flex-1 sm:max-w-sm">
          <Search aria-hidden />
          <input value={q} onChange={(ev) => { setQ(ev.target.value); setPage(1); }} placeholder="Search name, company, country, product…" aria-label="Search enquiries" className="a-input a-input-sm" />
        </div>
        {!inBin && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {[["", "All"], ...Object.entries(STATUS_LABEL)].map(([k, v]) => (
              <button key={k} className="a-chip" aria-pressed={status === k} onClick={() => { setStatus(k); setPage(1); }}>{v}</button>
            ))}
          </div>
        )}
      </div>
      <Notice kind="error">{err}</Notice>

      {!data ? <ListSkeleton rows={6} /> : data.items.length === 0 ? (
        <EmptyState icon={<Inbox />} title={inBin ? "Nothing in Deleted" : q || status ? "No enquiries match" : "No enquiries yet"}>
          {inBin ? "Enquiries you delete will wait here for 30 days." : q || status ? "Try a different search or status." : "They will appear here as soon as someone submits the enquiry form."}
        </EmptyState>
      ) : (
        <ul className="a-list">
          {data.items.map((x) => (
            <li key={x.id} className="a-row">
              <button onClick={() => openEnquiry(x)} className="a-row-btn flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 sm:flex-nowrap">
                <span className="flex min-w-0 items-start gap-3.5">
                  <span className={`mt-[7px] h-2 w-2 flex-none rounded-full ${x.status === "new" && !inBin ? "bg-[color:var(--a-accent)]" : "bg-transparent"}`} aria-label={x.status === "new" && !inBin ? "New" : undefined} />
                  <span className="min-w-0">
                    <span className="block truncate"><span className={x.status === "new" && !inBin ? "font-bold" : "font-semibold"}>{x.name}</span> <span className="text-[color:var(--a-ink2)]">· {x.company}</span></span>
                    <span className="block truncate text-[13px] text-[color:var(--a-ink3)]">#{x.number ?? x.id} · {x.country}{x.product ? ` · ${x.product}` : ""}</span>
                  </span>
                </span>
                <span className="flex flex-none items-center gap-4 pl-[22px] text-[13px] sm:pl-0">
                  {x.hasAttachment && <Paperclip aria-label="Has attachment" className="h-4 w-4 text-[color:var(--a-ink3)]" />}
                  {!inBin && x.emailStatus !== "sent" && <span className="a-status a-status-danger" title={x.emailError || "Notification email not sent"}>{emailLabel(x.emailStatus)}</span>}
                  <span className="text-[color:var(--a-ink3)]" title={new Date(x.createdAt + "Z").toLocaleString()}>{timeAgo(x.createdAt)}</span>
                  {inBin ? (
                    <span className={`a-tag ${(x.daysLeft ?? 0) <= 3 ? "a-tag-danger" : "a-tag-quiet"}`}>{x.daysLeft === 0 ? "Removed within 24 hours" : `${x.daysLeft} day${x.daysLeft === 1 ? "" : "s"} left`}</span>
                  ) : (
                    <span className={`a-status w-[92px] ${STATUS_CLASS[x.status] ?? ""}`}>{STATUS_LABEL[x.status]}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && data.pages > 1 && (
        <div className="mt-6 flex items-center justify-between text-[13.5px]">
          <button className="a-btn a-btn-ghost a-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="text-[color:var(--a-ink2)]">Page {data.page} of {data.pages}</span>
          <button className="a-btn a-btn-ghost a-btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      <Drawer open={open !== null && !!e} onClose={close} title={e ? `${e.name}` : ""} subtitle={e ? <>#{e.number ?? e.id} · {e.company} · {e.country} · <span title={new Date(e.createdAt + "Z").toLocaleString()}>{timeAgo(e.createdAt)}</span></> : undefined}
        footer={e && (inBin ? (
          <div className="flex flex-wrap gap-2">
            <button className="a-btn a-btn-primary" onClick={() => restore(e.id)}><RotateCcw />Restore</button>
            <button className="a-btn a-btn-danger" onClick={() => removeForever(e.id)}><Trash2 />Delete forever</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <a className="a-btn a-btn-primary" href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: your enquiry${e.product ? ` about ${e.product}` : ""}`)}`}><Mail />Reply by email</a>
            <button className="a-btn a-btn-danger ml-auto" onClick={() => remove(e.id)}><Trash2 />Delete</button>
          </div>
        ))}>
        {e && (
          <div className="space-y-7 text-[14px]">
            {inBin ? (
              <p className="text-[color:var(--a-ink2)]">Deleted {e.deletedAt ? new Date(e.deletedAt + "Z").toLocaleString() : ""}. Status when deleted: {STATUS_LABEL[e.status]}.</p>
            ) : (
              <div className="grid items-end gap-4 sm:grid-cols-[180px_1fr]">
                <label><span className="a-label">Status</span>
                  <select className="a-input" value={e.status} onChange={(ev) => patch(e.id, { status: ev.target.value })}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                {e.emailStatus !== "sent" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="a-status a-status-danger" title={e.emailError}><MailWarning className="h-4 w-4" />{emailLabel(e.emailStatus)}</span>
                    <button className="a-btn a-btn-ghost a-btn-sm" disabled={busy === "resend"} onClick={() => resend(e.id)}><RefreshCw /><BusyLabel busy={busy === "resend"} busyText="Sending…">Retry email</BusyLabel></button>
                  </div>
                ) : <span className="a-status a-status-ok">Notification email sent</span>}
              </div>
            )}
            {!inBin && e.emailStatus !== "sent" && e.emailError && <p className="-mt-3 text-[12.5px] text-[color:var(--a-danger)]">{e.emailError}</p>}

            <dl className="a-dl grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {([["Email", e.email], ["Phone", e.phone], ["Product / part", e.product], ["Quantity", e.quantity]] as const).map(([k, v]) => v ? (
                <div key={k}><dt>{k}</dt><dd className="whitespace-pre-line">{k === "Email" ? <a className="a-link" href={`mailto:${v}`}>{v}</a> : k === "Phone" ? <a className="a-link" href={`tel:${v.replace(/[^\d+]/g, "")}`}>{v}</a> : v}</dd></div>
              ) : null)}
            </dl>
            {e.requirements && <div className="a-dl"><dt>Technical requirements</dt><dd className="mt-1 whitespace-pre-wrap">{e.requirements}</dd></div>}
            <div className="a-dl"><dt>Message</dt><dd className="mt-1 whitespace-pre-wrap rounded-xl bg-[color:var(--a-bg)] p-4 leading-relaxed">{e.message}</dd></div>
            {e.hasAttachment && (
              <button className="a-btn a-btn-ghost" onClick={() => adminDownload(`/enquiries/${e.id}/attachment`, e.attachmentName || "attachment").catch((x) => toast.error(x.message))}><Paperclip />Download attachment<span className="max-w-[200px] truncate font-normal text-[color:var(--a-ink3)]">{e.attachmentName}</span></button>
            )}
            {inBin ? (
              e.notes && <div className="a-dl"><dt>Internal notes</dt><dd className="mt-1 whitespace-pre-wrap">{e.notes}</dd></div>
            ) : (
              <label className="block"><span className="a-label">Internal notes</span>
                <textarea className="a-input" rows={4} value={note} onChange={(ev) => setNote(ev.target.value)} onBlur={() => note !== e.notes && patch(e.id, { notes: note })} placeholder="Add a private note. Saved when you click away." />
                <span className="a-hint">Not visible to the buyer.</span>
              </label>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
