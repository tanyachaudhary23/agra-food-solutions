"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminFetch, uploadFile } from "@/lib/admin";
import { industries } from "@/lib/site";
import { BusyLabel, Card, Field, FormSkeleton, lines, Notice, PageTitle, useConfirm, useToast } from "@/components/admin/ui";

type Form = {
  name: string; slug: string; code: string; categoryId: number | ""; shortDescription: string; fullDescription: string;
  specifications: { label: string; value: string }[];
  applications: string; compatibility: string; variants: string; industries: string[];
  documents: { label: string; href: string }[];
  images: { src: string; alt: string }[];
  featured: boolean; status: "published" | "draft"; seoTitle: string; seoDescription: string; sortOrder: number;
};
type Cat = { id: number; name: string };

const empty: Form = {
  name: "", slug: "", code: "", categoryId: "", shortDescription: "", fullDescription: "", specifications: [],
  applications: "", compatibility: "", variants: "", industries: [], documents: [], images: [], featured: false, status: "published",
  seoTitle: "", seoDescription: "", sortOrder: 0,
};

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [f, setF] = useState<Form>(empty);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    adminFetch<Cat[]>("/categories").then((c) => {
      setCats(c);
      if (isNew && c[0]) setF((x) => ({ ...x, categoryId: c[0].id }));
    }).catch((e) => setErr(e.message));
    if (!isNew) {
      adminFetch<any>(`/products/${id}`).then((p) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        setF({
          name: p.name, slug: p.slug, code: p.code, categoryId: p.categoryId, shortDescription: p.shortDescription, fullDescription: p.fullDescription,
          specifications: p.specifications, industries: p.industries ?? [], applications: p.applications.join("\n"), compatibility: p.compatibility.join("\n"), variants: p.variants.join("\n"),
          documents: p.documents, images: p.images, featured: p.featured, status: p.status, seoTitle: p.seoTitle, seoDescription: p.seoDescription, sortOrder: p.sortOrder,
        });
        setLoaded(true);
      }).catch((e) => setErr(e.message));
    }
  }, [id, isNew]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = {
      ...f,
      applications: lines(f.applications), compatibility: lines(f.compatibility), variants: lines(f.variants),
      specifications: f.specifications.filter((s) => s.label.trim() && s.value.trim()),
      documents: f.documents.filter((d) => d.label.trim()),
    };
    try {
      if (isNew) {
        const r = await adminFetch<{ id: number }>("/products", { method: "POST", body });
        toast.success("Product created.");
        router.replace(`/admin/products/${r.id}`);
      } else {
        await adminFetch(`/products/${id}`, { method: "PUT", body });
        toast.success("Saved. The website updates within about 30 seconds.");
      }
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }

  async function addFiles(kind: "image" | "document", files: FileList | null) {
    if (!files) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(kind, file);
        if (kind === "image") setF((x) => ({ ...x, images: [...x.images, { src: url, alt: x.name }] }));
        else setF((x) => ({ ...x, documents: [...x.documents, { label: file.name.replace(/\.pdf$/i, ""), href: url }] }));
      }
      toast.success(kind === "image" ? "Photo uploaded. Remember to save the product." : "PDF uploaded. Remember to save the product.");
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }

  async function remove() {
    const ok = await confirm({ title: `Delete "${f.name}"?`, body: "This permanently removes the product. To hide it from the website instead, set its status to Draft and save.", confirmLabel: "Delete product", danger: true });
    if (!ok) return;
    try { await adminFetch(`/products/${id}`, { method: "DELETE" }); toast.success("Product deleted."); router.replace("/admin/products"); } catch (x) { toast.error((x as Error).message); }
  }

  if (!loaded) return err ? <Notice kind="error">{err}</Notice> : <FormSkeleton cards={3} />;

  return (
    <form onSubmit={save} className="space-y-6">
      <PageTitle title={isNew ? "Add product" : "Edit product"}>
        <Link href="/admin/products" className="btn btn-outline py-2">Back to list</Link>
        {!isNew && f.slug && <a href={`/products/${f.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline py-2">View on site ↗</a>}
      </PageTitle>
      <Card title="Basics">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Product name *"><input className="field" required value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Category *">
            <select className="field" required value={f.categoryId} onChange={(e) => set("categoryId", Number(e.target.value))}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Status" hint="Draft products are hidden from the website.">
            <select className="field" value={f.status} onChange={(e) => set("status", e.target.value as Form["status"])}>
              <option value="published">Published (visible)</option><option value="draft">Draft (hidden)</option>
            </select>
          </Field>
          <label className="flex items-center gap-3 self-end pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-forest" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} />Featured on the homepage</label>
          <div className="sm:col-span-2"><Field label="Short description" hint="One line shown on product cards."><input className="field" maxLength={300} value={f.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Full description" hint="Shown on the product page. Only state facts you can stand behind."><textarea className="field" rows={5} value={f.fullDescription} onChange={(e) => set("fullDescription", e.target.value)} /></Field></div>
        </div>
      </Card>

      <Card title="Photos" actions={<label className="btn btn-outline cursor-pointer py-2">Upload photos<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={(e) => { addFiles("image", e.target.files); e.target.value = ""; }} /></label>}>
        {f.images.length === 0 ? <p className="text-sm text-charcoal/70">No photos yet. The first photo is the main one. Photos are resized automatically.</p> : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {f.images.map((im, i) => (
              <li key={im.src} className="border border-forest/15 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.src} alt={im.alt} className="aspect-[4/3] w-full bg-white object-cover" />
                <input className="field mt-2" aria-label="Photo description (alt text)" placeholder="Describe the photo" value={im.alt} onChange={(e) => set("images", f.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                <div className="mt-2 flex gap-3 text-sm font-semibold">
                  {i > 0 && <button type="button" className="text-forest underline" onClick={() => set("images", [im, ...f.images.filter((_, j) => j !== i)])}>Make main</button>}
                  {i > 0 && <button type="button" className="text-forest underline" aria-label="Move photo earlier" onClick={() => set("images", f.images.map((x, j) => (j === i - 1 ? im : j === i ? f.images[i - 1] : x)))}>← Move</button>}
                  {i < f.images.length - 1 && <button type="button" className="text-forest underline" aria-label="Move photo later" onClick={() => set("images", f.images.map((x, j) => (j === i + 1 ? im : j === i ? f.images[i + 1] : x)))}>Move →</button>}
                  <button type="button" className="text-red-800 underline" onClick={() => set("images", f.images.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Technical specifications" actions={<button type="button" className="btn btn-outline py-2" onClick={() => set("specifications", [...f.specifications, { label: "", value: "" }])}>Add row</button>}>
        {f.specifications.length === 0 && <p className="text-sm text-charcoal/70">Add confirmed details only, e.g. Material, Size, Grade. Leave empty if unknown.</p>}
        <div className="space-y-3">
          {f.specifications.map((s, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <input className="field" aria-label="Specification name" placeholder="e.g. Material" value={s.label} onChange={(e) => set("specifications", f.specifications.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input className="field" aria-label="Specification value" placeholder="e.g. Stainless steel 304" value={s.value} onChange={(e) => set("specifications", f.specifications.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <button type="button" className="px-3 text-sm font-semibold text-red-800 underline" onClick={() => set("specifications", f.specifications.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Industries it is used in">
        <p className="mb-4 text-sm text-charcoal/70">
          Tick every industry this product is used in. Visitors who choose an industry on the website only see products ticked here.
          The first tags were set automatically from each product&apos;s category as a rough starting point, so please check them.
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {industries.map(([name, , slug]) => (
            <label key={slug} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-forest"
                checked={f.industries.includes(slug)}
                onChange={(e) => set("industries", e.target.checked ? [...f.industries, slug] : f.industries.filter((x) => x !== slug))}
              />
              {name}
            </label>
          ))}
        </div>
      </Card>

      <Card title="Lists (one item per line)">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Applications"><textarea className="field" rows={5} value={f.applications} onChange={(e) => set("applications", e.target.value)} /></Field>
          <Field label="Compatible equipment" hint="Only if confirmed."><textarea className="field" rows={5} value={f.compatibility} onChange={(e) => set("compatibility", e.target.value)} /></Field>
          <Field label="Available variants / sizes"><textarea className="field" rows={5} value={f.variants} onChange={(e) => set("variants", e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="Documents (PDF)" actions={<label className="btn btn-outline cursor-pointer py-2">Upload PDF<input type="file" accept="application/pdf" className="sr-only" onChange={(e) => { addFiles("document", e.target.files); e.target.value = ""; }} /></label>}>
        {f.documents.length === 0 ? <p className="text-sm text-charcoal/70">Drawings, data sheets or brochures for this product.</p> : (
          <ul className="space-y-3">
            {f.documents.map((d, i) => (
              <li key={d.href} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input className="field" aria-label="Document title" value={d.label} onChange={(e) => set("documents", f.documents.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <button type="button" className="px-3 text-sm font-semibold text-red-800 underline" onClick={() => set("documents", f.documents.filter((_, j) => j !== i))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Advanced">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Web address ending (slug)" hint="Leave blank to create it from the name. Changing it breaks old links."><input className="field" value={f.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Internal product code"><input className="field" value={f.code} onChange={(e) => set("code", e.target.value)} /></Field>
          <Field label="Search title (SEO)" hint="Leave blank to use the product name."><input className="field" maxLength={120} value={f.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} /></Field>
          <Field label="Display order" hint="Lower numbers appear first. 0 = put at the end."><input type="number" min={0} className="field" value={f.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} /></Field>
          <div className="sm:col-span-2"><Field label="Search description (SEO)"><textarea className="field" rows={2} maxLength={300} value={f.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} /></Field></div>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-forest/15 bg-ivory-200/95 px-5 py-4 backdrop-blur sm:mx-0">
        <button className="btn btn-forest" disabled={busy}><BusyLabel busy={busy} busyText="Working…">{isNew ? "Create product" : "Save changes"}</BusyLabel></button>
        {!isNew && <button type="button" onClick={remove} className="btn btn-outline !border-red-800 !text-red-800 hover:!bg-red-800 hover:!text-white">Delete product</button>}
      </div>
    </form>
  );
}
