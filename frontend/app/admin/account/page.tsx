"use client";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { adminFetch, tokenStore } from "@/lib/admin";
import { BusyLabel, Field, Notice, PageTitle, Section, Skeleton, useConfirm, useToast } from "@/components/admin/ui";

type Unused = { count: number; bytes: number; files: { name: string; bytes: number; modified: string; kind: string }[] };
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Lists pictures/PDFs no product uses any more and lets the owner delete them. Nothing is ever deleted automatically. */
function Storage() {
  const [data, setData] = useState<Unused | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const load = useCallback(() => { setErr(""); adminFetch<Unused>("/unused-files").then(setData).catch((e) => setErr(e.message)); }, []);
  useEffect(load, [load]);

  async function clean() {
    if (!data) return;
    const ok = await confirm({ title: `Delete ${data.count} unused file${data.count === 1 ? "" : "s"}?`, body: `This frees ${size(data.bytes)}. Pictures used by any product (including ones in the recycle bin) are never touched. This cannot be undone.`, confirmLabel: "Delete unused files", danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await adminFetch<{ deleted: number; bytes: number }>("/unused-files/delete", { method: "POST" });
      toast.success(`Deleted ${r.deleted} file${r.deleted === 1 ? "" : "s"} and freed ${size(r.bytes)}.`);
      load();
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <Section title="Storage" description="When you replace a product picture, the old file stays on the server so nothing breaks. Here you can remove the ones nothing uses any more.">
      {err ? <Notice kind="error">{err}</Notice> : !data ? <Skeleton className="h-16 w-full max-w-md" /> : data.count === 0 ? (
        <p className="text-[15px]">No unused files. Every picture and PDF on the server is used by a product. (Files uploaded in the last 24 hours are never counted.)</p>
      ) : (
        <div className="max-w-xl space-y-4">
          <p className="text-[15px]"><strong>{data.count}</strong> unused file{data.count === 1 ? "" : "s"} taking <strong>{size(data.bytes)}</strong>. Check the pictures below, then delete.</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {data.files.slice(0, 24).map((f) => (
              <li key={f.name} className="text-[12px]">
                {f.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`${API_URL}/uploads/${f.name}`} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-black/5 object-cover" /> : <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-black/5 font-semibold">{f.kind.toUpperCase()}</div>}
                <span className="mt-1 block text-[color:var(--a-ink2)]">{size(f.bytes)}</span>
              </li>
            ))}
          </ul>
          {data.count > 24 && <p className="text-[13px] text-[color:var(--a-ink2)]">…and {data.count - 24} more.</p>}
          <button type="button" onClick={clean} disabled={busy} className="a-btn a-btn-danger-solid"><BusyLabel busy={busy} busyText="Deleting…">Delete {data.count} unused file{data.count === 1 ? "" : "s"}</BusyLabel></button>
        </div>
      )}
    </Section>
  );
}

export default function Account() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setErr(""); setBusy(true);
    if (f.get("newPassword") !== f.get("confirm")) { setBusy(false); return setErr("The new passwords do not match."); }
    try {
      const r = await adminFetch<{ token?: string }>("/password", { method: "POST", body: { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") } });
      if (r.token) tokenStore.set(r.token);
      toast.success("Password changed. Other devices were signed out.");
      form.reset();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageTitle title="Account" description="Keep your admin sign-in secure." />
      <Section title="Change password" description="Changing it signs you out on every other device.">
        <form onSubmit={submit} className="max-w-md space-y-5">
          <Field label="Current password"><input name="currentPassword" type="password" autoComplete="current-password" required className="a-input" /></Field>
          <Field label="New password" hint="At least 10 characters."><input name="newPassword" type="password" autoComplete="new-password" minLength={10} required className="a-input" /></Field>
          <Field label="Repeat new password"><input name="confirm" type="password" autoComplete="new-password" minLength={10} required className="a-input" /></Field>
          <Notice kind="error">{err}</Notice>
          <button className="a-btn a-btn-primary" disabled={busy}><BusyLabel busy={busy} busyText="Changing…">Change password</BusyLabel></button>
        </form>
      </Section>
      <Storage />
    </>
  );
}
