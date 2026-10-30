"use client";
import { useEffect, useState } from "react";
import { Plus, Tags, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin";
import { BusyLabel, EmptyState, Field, ListSkeleton, Notice, PageTitle, Section, useConfirm, useToast } from "@/components/admin/ui";

type Cat = { id: number; slug: string; name: string; description: string; sortOrder: number; productCount: number };

export default function Categories() {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [orig, setOrig] = useState<Record<number, string>>({}); // what each row looked like when loaded, to show "unsaved"
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const sig = (c: Cat) => JSON.stringify([c.name, c.description, c.sortOrder]);
  const load = () => adminFetch<Cat[]>("/categories").then((c) => { setCats(c); setOrig(Object.fromEntries(c.map((x) => [x.id, sig(x)]))); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const wrap = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const edit = (id: number, patch: Partial<Cat>) => setCats((cs) => cs && cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <>
      <PageTitle title="Categories" description="Groups that organise your products on the website." />
      <Notice kind="error">{err}</Notice>

      <Section title="Add a category" description="New categories appear on the website once they have a published product.">
        <form className="grid gap-4 sm:grid-cols-[2fr_3fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); wrap("add", async () => { await adminFetch("/categories", { method: "POST", body: draft }); setDraft({ name: "", description: "" }); }, "Category added."); }}>
          <Field label="Name"><input className="a-input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Description"><input className="a-input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
          <button className="a-btn a-btn-primary !h-[42px]" disabled={!!busy}><BusyLabel busy={busy === "add"} busyText="Adding…"><Plus />Add</BusyLabel></button>
        </form>
      </Section>

      <Section title="All categories" description="Lower order numbers appear first. A category with products cannot be deleted.">
        {!cats && !err && <ListSkeleton rows={4} />}
        {cats && cats.length === 0 && <EmptyState icon={<Tags />} title="No categories yet">Add your first category above.</EmptyState>}
        {cats && cats.length > 0 && (
          <ul className="a-list a-stagger">
            {cats.map((c) => {
              const changed = orig[c.id] !== sig(c);
              return (
                <li key={c.id} className="a-row px-3 py-5">
                  <div className="grid gap-4 sm:grid-cols-[2fr_3fr_90px]">
                    <Field label="Name"><input className="a-input" value={c.name} onChange={(e) => edit(c.id, { name: e.target.value })} /></Field>
                    <Field label="Description"><input className="a-input" value={c.description} onChange={(e) => edit(c.id, { description: e.target.value })} /></Field>
                    <Field label="Order"><input type="number" min={0} className="a-input" value={c.sortOrder} onChange={(e) => edit(c.id, { sortOrder: Number(e.target.value) || 0 })} /></Field>
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[color:var(--a-ink3)]">
                    <span>{c.productCount} product{c.productCount === 1 ? "" : "s"}</span>
                    <span className="hidden sm:inline">/products?category={c.slug}</span>
                    {changed && <span className="a-status a-status-new a-fade">Unsaved</span>}
                    <span className="ml-auto flex items-center gap-2">
                      <button className="a-btn a-btn-danger a-btn-sm" disabled={!!busy || c.productCount > 0} title={c.productCount > 0 ? "Move or delete its products first" : ""} onClick={async () => { if (await confirm({ title: `Delete category "${c.name}"?`, body: "This cannot be undone.", confirmLabel: "Delete category", danger: true })) wrap(`del${c.id}`, () => adminFetch(`/categories/${c.id}`, { method: "DELETE" }), "Category deleted."); }}><Trash2 />Delete</button>
                      <button className="a-btn a-btn-primary a-btn-sm" disabled={!!busy || !changed} onClick={() => wrap(`save${c.id}`, () => adminFetch(`/categories/${c.id}`, { method: "PUT", body: { name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder } }), "Category saved.")}><BusyLabel busy={busy === `save${c.id}`} busyText="Saving…">Save</BusyLabel></button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
