"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin";
import { BusyLabel, Card, Field, ListSkeleton, Notice, PageTitle, useConfirm, useToast } from "@/components/admin/ui";

type Cat = { id: number; slug: string; name: string; description: string; sortOrder: number; productCount: number };

export default function Categories() {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => adminFetch<Cat[]>("/categories").then(setCats).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const wrap = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const edit = (id: number, patch: Partial<Cat>) => setCats((cs) => cs && cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <>
      <PageTitle title="Categories" />
      <Notice kind="error">{err}</Notice>

      <div className="mt-4 space-y-4">
        {!cats && !err && <div className="border border-forest/15 bg-white"><ListSkeleton rows={4} /></div>}
        {cats?.map((c) => (
          <Card key={c.id}>
            <div className="grid gap-4 sm:grid-cols-[2fr_3fr_6rem]">
              <Field label="Name"><input className="field" value={c.name} onChange={(e) => edit(c.id, { name: e.target.value })} /></Field>
              <Field label="Description"><input className="field" value={c.description} onChange={(e) => edit(c.id, { description: e.target.value })} /></Field>
              <Field label="Order"><input type="number" min={0} className="field" value={c.sortOrder} onChange={(e) => edit(c.id, { sortOrder: Number(e.target.value) || 0 })} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <button className="btn btn-forest py-2" disabled={!!busy} onClick={() => wrap(`save${c.id}`, () => adminFetch(`/categories/${c.id}`, { method: "PUT", body: { name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder } }), "Category saved.")}><BusyLabel busy={busy === `save${c.id}`} busyText="Saving…">Save</BusyLabel></button>
              <span className="text-charcoal/60">{c.productCount} product(s) · /products?category={c.slug}</span>
              <button className="ml-auto font-semibold text-red-800 underline disabled:opacity-40" disabled={c.productCount > 0} title={c.productCount > 0 ? "Move or delete its products first" : ""} onClick={async () => { if (await confirm({ title: `Delete category "${c.name}"?`, body: "This cannot be undone.", confirmLabel: "Delete category", danger: true })) wrap(`del${c.id}`, () => adminFetch(`/categories/${c.id}`, { method: "DELETE" }), "Category deleted."); }}>Delete</button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card title="Add a category">
          <form className="grid gap-4 sm:grid-cols-[2fr_3fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); wrap("add", async () => { await adminFetch("/categories", { method: "POST", body: draft }); setDraft({ name: "", description: "" }); }, "Category added."); }}>
            <Field label="Name"><input className="field" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Description"><input className="field" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <button className="btn btn-forest" disabled={!!busy}><BusyLabel busy={busy === "add"} busyText="Adding…">Add</BusyLabel></button>
          </form>
        </Card>
      </div>
    </>
  );
}
