"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin";
import { ListSkeleton, Notice, PageTitle, useToast } from "@/components/admin/ui";
import type { Product } from "@/lib/types";

type AdminProduct = Product & { categoryId: number; sortOrder: number };

export default function Products() {
  const [items, setItems] = useState<AdminProduct[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const toast = useToast();

  const load = () => adminFetch<AdminProduct[]>("/products").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter((p) => !t || `${p.name} ${p.categoryName} ${p.code}`.toLowerCase().includes(t));
  }, [items, q]);

  async function toggle(p: AdminProduct) {
    if (busyId) return;
    const next = p.status === "published" ? "draft" : "published";
    setBusyId(p.id);
    setItems((cur) => cur && cur.map((x) => (x.id === p.id ? { ...x, status: next } : x))); // update instantly
    try {
      const full = await adminFetch<AdminProduct>(`/products/${p.id}`);
      await adminFetch(`/products/${p.id}`, { method: "PUT", body: { ...full, status: next } });
      toast.success(next === "published" ? `"${p.name}" is now published.` : `"${p.name}" is now hidden (draft).`);
    } catch (e) {
      setItems((cur) => cur && cur.map((x) => (x.id === p.id ? { ...x, status: p.status } : x))); // put it back
      toast.error((e as Error).message);
    } finally { setBusyId(null); }
  }

  return (
    <>
      <PageTitle title="Products">
        <Link href="/admin/products/new" className="btn btn-forest py-2">Add product</Link>
      </PageTitle>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" aria-label="Search products" className="field mb-4 max-w-sm" />
      <Notice kind="error">{err}</Notice>
      <div className="mt-4 overflow-x-auto border border-forest/15 bg-white">
        {!items ? <ListSkeleton rows={8} /> : <table className="w-full text-left text-sm">
          <thead className="bg-ivory font-heading text-xs uppercase tracking-wider text-forest">
            <tr><th className="p-3">Image</th><th className="p-3">Name</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-forest/10">
            {shown.length === 0 ? <tr><td className="p-5 text-charcoal/70" colSpan={5}>No products match your search.</td></tr> : shown.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-ivory/60">
                <td className="p-3">{p.images[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.images[0].src} alt="" className="h-12 w-16 object-cover" /> : <span className="text-xs text-charcoal/50">none</span>}</td>
                <td className="p-3 font-semibold">{p.name}{p.featured && <span className="ml-2 bg-brass/30 px-1.5 py-0.5 text-[10px] font-bold uppercase">Featured</span>}</td>
                <td className="p-3">{p.categoryName}</td>
                <td className="p-3"><span className={p.status === "published" ? "text-forest" : "text-charcoal/50"}>{p.status === "published" ? "Published" : "Draft"}</span></td>
                <td className="space-x-3 p-3 text-right whitespace-nowrap">
                  <button className="font-semibold text-brass-700 transition-colors hover:text-forest disabled:opacity-50" disabled={busyId === p.id} onClick={() => toggle(p)}>{p.status === "published" ? "Unpublish" : "Publish"}</button>
                  <Link className="font-semibold text-forest underline" href={`/admin/products/${p.id}`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
      <p className="mt-3 text-xs text-charcoal/60">{shown.length} product(s). Website changes appear within about 30 seconds.</p>
    </>
  );
}
