"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, ImageOff, PackageOpen, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin";
import { industries } from "@/lib/site";
import { EmptyState, ListSkeleton, Notice, PageTitle, useConfirm, useToast } from "@/components/admin/ui";
import type { Product } from "@/lib/types";

type AdminProduct = Product & { categoryId: number; sortOrder: number; daysLeft?: number };

export default function Products() {
  const [items, setItems] = useState<AdminProduct[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [ind, setInd] = useState("");
  const [status, setStatus] = useState<"" | "published" | "draft">("");
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [view, setView] = useState<"active" | "deleted">("active");
  const [binCount, setBinCount] = useState(0);
  const toast = useToast();
  const confirm = useConfirm();

  const load = (v = view) => {
    adminFetch<AdminProduct[]>(v === "deleted" ? "/products?view=deleted" : "/products").then(setItems).catch((e) => setErr(e.message));
    adminFetch<{ deletedProducts: number }>("/stats").then((s) => setBinCount(s.deletedProducts)).catch(() => {});
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function switchView(v: "active" | "deleted") { setView(v); setItems(null); setErr(""); clearFilters(); load(v); }
  function clearFilters() { setQ(""); setCat(""); setInd(""); setStatus(""); }

  async function restore(p: AdminProduct) {
    try { await adminFetch(`/products/${p.id}/restore`, { method: "POST" }); toast.success(`"${p.name}" restored as a Draft. Publish it when you want it on the website.`); load(); } catch (e) { toast.error((e as Error).message); }
  }
  async function deleteForever(p: AdminProduct) {
    const ok = await confirm({ title: `Delete "${p.name}" forever?`, body: "This removes the product permanently, right now. It cannot be undone.", confirmLabel: "Delete forever", danger: true });
    if (!ok) return;
    try { await adminFetch(`/products/${p.id}/permanent`, { method: "DELETE" }); toast.success("Product deleted forever."); load(); } catch (e) { toast.error((e as Error).message); }
  }

  const categories = useMemo(() => {
    const m = new Map<string, string>();
    (items ?? []).forEach((p) => m.set(p.category, p.categoryName));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter((p) =>
      (!t || `${p.name} ${p.categoryName} ${p.code}`.toLowerCase().includes(t)) &&
      (!cat || p.category === cat) &&
      (!ind || p.industries.includes(ind)) &&
      (!status || p.status === status));
  }, [items, q, cat, ind, status]);
  const filtering = !!(q || cat || ind || status);

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

  const published = (items ?? []).filter((p) => p.status === "published").length;
  const inBin = view === "deleted";

  return (
    <>
      <PageTitle title="Products" description={items && !inBin ? `${items.length} product${items.length === 1 ? "" : "s"} · ${published} published, ${items.length - published} draft` : "Everything in your catalogue."}>
        <Link href="/admin/products/import" className="a-btn a-btn-ghost"><FileSpreadsheet />Import</Link>
        <Link href="/admin/products/new" className="a-btn a-btn-primary"><Plus />Add product</Link>
      </PageTitle>

      <div role="tablist" aria-label="Product list" className="a-tabs mb-6">
        {([["active", "Products"], ["deleted", `Deleted${binCount ? ` (${binCount})` : ""}`]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => switchView(k)} className="a-tab">{label}</button>
        ))}
      </div>
      {inBin && <p className="mb-5 max-w-2xl text-[13.5px] text-[color:var(--a-ink2)]">Deleted products are hidden everywhere on the website. You can restore one within 30 days (it comes back as a Draft); after that it is removed for good.</p>}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="a-search min-w-[220px] flex-1 sm:max-w-sm">
          <Search aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code or category…" aria-label="Search products" className="a-input a-input-sm" />
        </div>
        {!inBin && (<>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category" className="a-input a-input-sm !w-auto max-w-[220px]">
            <option value="">All categories</option>
            {categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
          <select value={ind} onChange={(e) => setInd(e.target.value)} aria-label="Filter by industry" className="a-input a-input-sm !w-auto max-w-[200px]">
            <option value="">All industries</option>
            {industries.map(([name, , slug]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status" className="a-input a-input-sm !w-auto">
            <option value="">Any status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </>)}
        {filtering && <button className="a-link text-[13px]" onClick={clearFilters}>Clear filters</button>}
      </div>
      <Notice kind="error">{err}</Notice>

      {!items ? <ListSkeleton rows={8} /> : shown.length === 0 ? (
        items.length === 0 ? (
          <EmptyState icon={<PackageOpen />} title={inBin ? "Nothing in Deleted" : "No products yet"} action={inBin ? undefined : <Link href="/admin/products/new" className="a-btn a-btn-primary"><Plus />Add your first product</Link>}>
            {inBin ? "Products you delete will wait here for 30 days." : "Add products one by one, or import many at once from an Excel file."}
          </EmptyState>
        ) : (
          <EmptyState icon={<Search />} title="No products match" action={<button className="a-btn a-btn-ghost" onClick={clearFilters}>Clear filters</button>}>Try a different search or remove a filter.</EmptyState>
        )
      ) : (
        <ul className="a-list">
          {shown.map((p) => (
            <li key={p.id} className="a-row">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-3.5 sm:flex-nowrap">
                <Link href={inBin ? "#" : `/admin/products/${p.id}`} tabIndex={inBin ? -1 : 0} aria-label={inBin ? undefined : `Edit ${p.name}`} className="flex min-w-0 flex-1 items-center gap-4" onClick={(e) => inBin && e.preventDefault()}>
                  <span className="a-thumb">{p.images[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.images[0].src} alt="" loading="lazy" /> : <ImageOff className="h-5 w-5" aria-label="No photo" />}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2"><span className="truncate font-semibold">{p.name}</span>{p.featured && <span className="a-tag">Featured</span>}</span>
                    <span className="block truncate text-[13px] text-[color:var(--a-ink3)]">{p.code ? `${p.code} · ` : ""}{p.categoryName}</span>
                  </span>
                </Link>
                <div className="ml-[72px] flex flex-none items-center gap-5 sm:ml-0">
                  {inBin ? (
                    <span className="text-[13px] text-[color:var(--a-ink3)]">Removed in {p.daysLeft ?? 30} day{p.daysLeft === 1 ? "" : "s"}</span>
                  ) : (
                    <span className={`a-status w-[92px] ${p.status === "published" ? "a-status-ok" : "a-status-muted"}`}>{p.status === "published" ? "Published" : "Draft"}</span>
                  )}
                  {inBin ? (<>
                    <button className="a-btn a-btn-ghost a-btn-sm" onClick={() => restore(p)}><RotateCcw />Restore</button>
                    <button className="a-btn a-btn-danger a-btn-sm" onClick={() => deleteForever(p)}><Trash2 />Delete forever</button>
                  </>) : (<>
                    <button className="a-btn a-btn-quiet a-btn-sm" disabled={busyId === p.id} onClick={() => toggle(p)}>{p.status === "published" ? "Unpublish" : "Publish"}</button>
                    <Link className="a-btn a-btn-ghost a-btn-sm" href={`/admin/products/${p.id}`}>Edit</Link>
                  </>)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {items && shown.length > 0 && <p className="mt-4 text-[12.5px] text-[color:var(--a-ink3)]">{shown.length} shown. Website changes appear within about 30 seconds.</p>}
    </>
  );
}
