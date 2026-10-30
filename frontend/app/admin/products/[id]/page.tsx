"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, FileText, ImagePlus, Plus, Star, Trash2, X } from "lucide-react";
import { adminFetch, uploadFileWithProgress } from "@/lib/admin";
import { industries } from "@/lib/site";
import { BusyLabel, Field, FormSkeleton, lines, Notice, PageTitle, Section, useConfirm, useToast, useUnsavedChanges } from "@/components/admin/ui";

type Form = {
  name: string; slug: string; code: string; categoryId: number | ""; shortDescription: string; fullDescription: string;
  specifications: { label: string; value: string }[];
  applications: string; compatibility: string; variants: string; industries: string[];
  documents: { label: string; href: string }[];
  images: { src: string; alt: string }[];
  featured: boolean; status: "published" | "draft"; seoTitle: string; seoDescription: string; sortOrder: number;
};
type Cat = { id: number; name: string };
type Upload = { id: number; name: string; pct: number };

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
  const [snap, setSnap] = useState("");
  const [cats, setCats] = useState<Cat[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [nextCode, setNextCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const uploadId = useRef(1);
  const toast = useToast();
  const confirm = useConfirm();

  const dirty = loaded && snap !== "" && JSON.stringify(f) !== snap;
  useUnsavedChanges(dirty);

  useEffect(() => {
    adminFetch<{ code: string }>("/products/next-code").then((r) => setNextCode(r.code)).catch(() => {});
  }, []);

  useEffect(() => {
    adminFetch<Cat[]>("/categories").then((c) => {
      setCats(c);
      if (isNew) { const init = { ...empty, categoryId: c[0]?.id ?? "" }; setF(init); setSnap(JSON.stringify(init)); }
    }).catch((e) => setErr(e.message));
    if (!isNew) {
      adminFetch<any>(`/products/${id}`).then((p) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const form: Form = {
          name: p.name, slug: p.slug, code: p.code, categoryId: p.categoryId, shortDescription: p.shortDescription, fullDescription: p.fullDescription,
          specifications: p.specifications, industries: p.industries ?? [], applications: p.applications.join("\n"), compatibility: p.compatibility.join("\n"), variants: p.variants.join("\n"),
          documents: p.documents, images: p.images, featured: p.featured, status: p.status, seoTitle: p.seoTitle, seoDescription: p.seoDescription, sortOrder: p.sortOrder,
        };
        setF(form); setSnap(JSON.stringify(form));
        setLoaded(true);
      }).catch((e) => setErr(e.message));
    }
  }, [id, isNew]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (uploads.length) return toast.error("Please wait for the uploads to finish.");
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
        setSnap(JSON.stringify(f));
        toast.success("Product created.");
        router.replace(`/admin/products/${r.id}`);
      } else {
        await adminFetch(`/products/${id}`, { method: "PUT", body });
        setSnap(JSON.stringify(f));
        toast.success("Saved. The website updates within about 30 seconds.");
      }
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }

  /** Uploads one file at a time, with a progress bar for each. */
  async function addFiles(kind: "image" | "document", files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files).filter((x) => (kind === "image" ? x.type.startsWith("image/") : x.type === "application/pdf" || /\.pdf$/i.test(x.name)));
    if (list.length === 0) return toast.error(kind === "image" ? "Please choose image files (JPG, PNG, WebP or GIF)." : "Please choose PDF files.");
    let ok = 0;
    for (const file of list) {
      const uid = uploadId.current++;
      setUploads((u) => [...u, { id: uid, name: file.name, pct: 0 }]);
      try {
        const url = await uploadFileWithProgress(kind, file, (pct) => setUploads((u) => u.map((x) => (x.id === uid ? { ...x, pct } : x))));
        if (kind === "image") setF((x) => ({ ...x, images: [...x.images, { src: url, alt: x.name }] }));
        else setF((x) => ({ ...x, documents: [...x.documents, { label: file.name.replace(/\.pdf$/i, ""), href: url }] }));
        ok++;
      } catch (x) { toast.error(`${file.name}: ${(x as Error).message}`); }
      finally { setUploads((u) => u.filter((y) => y.id !== uid)); }
    }
    if (ok) toast.success(`${ok} ${kind === "image" ? (ok === 1 ? "photo" : "photos") : (ok === 1 ? "PDF" : "PDFs")} uploaded. Save the product to keep ${ok === 1 ? "it" : "them"}.`);
  }

  function moveImage(from: number, to: number) {
    if (from === to || to < 0 || to >= f.images.length) return;
    const next = [...f.images];
    const [im] = next.splice(from, 1);
    next.splice(to, 0, im);
    set("images", next);
  }

  async function back(e: React.MouseEvent) {
    e.preventDefault();
    if (dirty && !(await confirm({ title: "Leave without saving?", body: "You have changes that are not saved yet. If you leave now they will be lost.", confirmLabel: "Leave without saving", cancelLabel: "Keep editing", danger: true }))) return;
    router.push("/admin/products");
  }

  async function remove() {
    const ok = await confirm({ title: `Delete "${f.name}"?`, body: f.status === "published" ? "This product is live on your website. Deleting it removes it from the website, the catalogue PDF and all enquiry forms straight away. You can bring it back from Products > Deleted for 30 days. To only hide it, set its status to Draft instead." : "It will be removed from the admin list. You can bring it back from Products > Deleted for 30 days.", confirmLabel: "Yes, delete product", danger: true });
    if (!ok) return;
    try { await adminFetch(`/products/${id}`, { method: "DELETE" }); toast.success("Product moved to Deleted. You can restore it for 30 days."); router.replace("/admin/products"); } catch (x) { toast.error((x as Error).message); }
  }

  if (!loaded) return err ? <Notice kind="error">{err}</Notice> : <FormSkeleton sections={4} />;

  const imageUploads = uploads.filter((u) => !/\.pdf$/i.test(u.name));
  const fileInput = (kind: "image" | "document", multiple = true) => (
    <input type="file" accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/gif" : "application/pdf"} multiple={multiple} className="sr-only" onChange={(e) => { addFiles(kind, e.target.files); e.target.value = ""; }} />
  );

  return (
    <form onSubmit={save}>
      <PageTitle title={isNew ? "Add product" : f.name || "Edit product"} description={isNew ? "Fill in the basics, add photos, then publish." : f.code ? `Code ${f.code}` : undefined}>
        {!isNew && f.slug && f.status === "published" && <a href={`/products/${f.slug}`} target="_blank" rel="noopener noreferrer" className="a-btn a-btn-ghost"><ExternalLink />View on site</a>}
      </PageTitle>

      <Section title="Basic information" description="The name and category are required. The short line appears on product cards.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Product name *"><input className="a-input" required value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Category *">
            <select className="a-input" required value={f.categoryId} onChange={(e) => set("categoryId", Number(e.target.value))}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="Short description" hint="One line shown on product cards."><input className="a-input" maxLength={300} value={f.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} /></Field></div>
        </div>
      </Section>

      <Section title="Description" description="Shown on the product page. Only state facts you can stand behind.">
        <Field label="Full description"><textarea className="a-input" rows={6} value={f.fullDescription} onChange={(e) => set("fullDescription", e.target.value)} /></Field>
      </Section>

      <Section title="Photos" description="The first photo is the main one. Drag photos to reorder them. Photos are resized automatically.">
        {f.images.length === 0 && uploads.length === 0 ? (
          <label className="a-dropzone" data-over={fileOver}
            onDragOver={(e) => { e.preventDefault(); setFileOver(true); }} onDragLeave={() => setFileOver(false)}
            onDrop={(e) => { e.preventDefault(); setFileOver(false); addFiles("image", e.dataTransfer.files); }}>
            <ImagePlus aria-hidden />
            <span className="font-heading text-[15px] font-bold text-[color:var(--a-ink)]">Drop photos here, or click to choose</span>
            <span className="text-[13px] text-[color:var(--a-ink3)]">JPG, PNG, WebP or GIF</span>
            {fileInput("image")}
          </label>
        ) : (
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {f.images.map((im, i) => (
              <li key={im.src} className="a-photo" draggable data-dragging={dragFrom === i} data-over={dragOver === i && dragFrom !== null && dragFrom !== i}
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
                onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
                onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
                onDrop={(e) => { if (dragFrom !== null) { e.preventDefault(); moveImage(dragFrom, i); } setDragFrom(null); setDragOver(null); }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}>
                <div className="a-photo-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.src} alt={im.alt} draggable={false} />
                  {i === 0 ? <span className="a-tag absolute left-2 top-2 !bg-[color:var(--a-brand)] !text-[color:var(--a-accent)]">Main</span> : null}
                  <div className="a-photo-tools">
                    {i > 0 && <button type="button" className="a-photo-tool" title="Make main photo" aria-label="Make main photo" onClick={() => moveImage(i, 0)}><Star /></button>}
                    {i > 0 && <button type="button" className="a-photo-tool" title="Move earlier" aria-label="Move photo earlier" onClick={() => moveImage(i, i - 1)}><ArrowLeft /></button>}
                    {i < f.images.length - 1 && <button type="button" className="a-photo-tool" title="Move later" aria-label="Move photo later" onClick={() => moveImage(i, i + 1)}><ArrowRight /></button>}
                    <button type="button" className="a-photo-tool is-danger" title="Remove photo" aria-label="Remove photo" onClick={() => set("images", f.images.filter((_, j) => j !== i))}><Trash2 /></button>
                  </div>
                </div>
                <input className="a-input a-input-sm !rounded-none !border-0 !border-t !border-[color:var(--a-line)] !text-[13px]" aria-label="Photo description (alt text)" placeholder="Describe the photo" value={im.alt} onChange={(e) => set("images", f.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
              </li>
            ))}
            {imageUploads.map((u) => (
              <li key={u.id} className="a-photo" aria-live="polite">
                <div className="a-photo-img grid place-items-center"><ImagePlus className="h-6 w-6 text-[color:var(--a-ink3)]" /></div>
                <div className="space-y-1.5 p-3"><p className="truncate text-[12.5px] text-[color:var(--a-ink2)]">{u.name}</p><div className="a-progress" role="progressbar" aria-valuenow={u.pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${u.pct}%` }} /></div></div>
              </li>
            ))}
            <li>
              <label className="a-dropzone h-full min-h-[150px]" data-over={fileOver}
                onDragOver={(e) => { if (dragFrom === null) { e.preventDefault(); setFileOver(true); } }} onDragLeave={() => setFileOver(false)}
                onDrop={(e) => { if (dragFrom === null) { e.preventDefault(); setFileOver(false); addFiles("image", e.dataTransfer.files); } }}>
                <ImagePlus aria-hidden />
                <span className="font-heading text-[13.5px] font-bold text-[color:var(--a-ink)]">Add photos</span>
                {fileInput("image")}
              </label>
            </li>
          </ul>
        )}
      </Section>

      <Section title="Specifications" description="Add confirmed details only, such as material, size or grade. Leave empty if unknown.">
        <div className="space-y-3">
          {f.specifications.map((s, i) => (
            <div key={i} className="a-rise grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <input className="a-input col-span-1" aria-label="Specification name" placeholder="e.g. Material" value={s.label} onChange={(e) => set("specifications", f.specifications.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <button type="button" aria-label="Remove specification" className="a-btn a-btn-quiet a-btn-icon !h-[42px] sm:order-3" onClick={() => set("specifications", f.specifications.filter((_, j) => j !== i))}><X /></button>
              <input className="a-input col-span-2 sm:col-span-1" aria-label="Specification value" placeholder="e.g. Stainless steel 304" value={s.value} onChange={(e) => set("specifications", f.specifications.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            </div>
          ))}
          <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={() => set("specifications", [...f.specifications, { label: "", value: "" }])}><Plus />Add specification</button>
        </div>
      </Section>

      <Section title="Industries" description="Visitors who pick an industry on the website only see products tagged here. The first tags were set automatically from each category, so please check them.">
        <div className="flex flex-wrap gap-2">
          {industries.map(([name, , slug]) => (
            <button key={slug} type="button" className="a-chip !h-9" aria-pressed={f.industries.includes(slug)} onClick={() => set("industries", f.industries.includes(slug) ? f.industries.filter((x) => x !== slug) : [...f.industries, slug])}>{name}</button>
          ))}
        </div>
      </Section>

      <Section title="More details" description="One item per line.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Applications"><textarea className="a-input" rows={5} value={f.applications} onChange={(e) => set("applications", e.target.value)} /></Field>
          <Field label="Compatible equipment" hint="Only if confirmed."><textarea className="a-input" rows={5} value={f.compatibility} onChange={(e) => set("compatibility", e.target.value)} /></Field>
          <Field label="Variants / sizes"><textarea className="a-input" rows={5} value={f.variants} onChange={(e) => set("variants", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Documents" description="Drawings, data sheets or brochures for this product (PDF).">
        <div className="space-y-3">
          {f.documents.map((d, i) => (
            <div key={d.href} className="a-rise flex items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-[color:var(--a-sunk)]"><FileText className="h-[18px] w-[18px]" /></span>
              <input className="a-input" aria-label="Document title" value={d.label} onChange={(e) => set("documents", f.documents.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <button type="button" aria-label="Remove document" className="a-btn a-btn-quiet a-btn-icon !h-[42px]" onClick={() => set("documents", f.documents.filter((_, j) => j !== i))}><X /></button>
            </div>
          ))}
          {uploads.filter((u) => /\.pdf$/i.test(u.name)).map((u) => (
            <div key={u.id} className="space-y-1.5" aria-live="polite"><p className="truncate text-[12.5px] text-[color:var(--a-ink2)]">{u.name}</p><div className="a-progress"><span style={{ width: `${u.pct}%` }} /></div></div>
          ))}
          <label className="a-btn a-btn-ghost a-btn-sm cursor-pointer"><Plus />Upload PDF{fileInput("document")}</label>
        </div>
      </Section>

      <Section title="Publishing" description="Draft products are hidden from the website.">
        <div className="space-y-5">
          <div>
            <span className="a-label">Status</span>
            <div className="a-seg" role="group" aria-label="Status">
              <button type="button" aria-pressed={f.status === "published"} onClick={() => set("status", "published")}>Published</button>
              <button type="button" aria-pressed={f.status === "draft"} onClick={() => set("status", "draft")}>Draft</button>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-[14px]"><input type="checkbox" role="switch" className="a-switch" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} />Feature this product on the homepage</label>
        </div>
      </Section>

      <Section title="Advanced" description="Web address, internal code and search-engine text. Most products never need changes here.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Web address ending (slug)" hint="Leave blank to create it from the name. Changing it breaks old links."><input className="a-input" value={f.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Internal product code" hint={nextCode ? `Leave blank and it becomes ${nextCode} when you save.` : "Leave blank to number it automatically when you save."}><input className="a-input" placeholder={nextCode} value={f.code} onChange={(e) => set("code", e.target.value)} /></Field>
          <Field label="Search title (SEO)" hint="Leave blank to use the product name."><input className="a-input" maxLength={120} value={f.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} /></Field>
          <Field label="Display order" hint="Lower numbers appear first. 0 = put at the end."><input type="number" min={0} className="a-input" value={f.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} /></Field>
          <div className="sm:col-span-2"><Field label="Search description (SEO)"><textarea className="a-input" rows={2} maxLength={300} value={f.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} /></Field></div>
        </div>
      </Section>

      <div className="a-savebar flex flex-wrap items-center gap-3">
        <button className="a-btn a-btn-primary" disabled={busy || uploads.length > 0}><BusyLabel busy={busy} busyText="Saving…">{isNew ? "Create product" : "Save changes"}</BusyLabel></button>
        <Link href="/admin/products" onClick={back} className="a-btn a-btn-ghost">Cancel</Link>
        {dirty && <span className="a-status a-status-new a-fade" role="status">Unsaved changes</span>}
        {uploads.length > 0 && <span className="text-[13px] text-[color:var(--a-ink2)]" role="status">Uploading {uploads.length} file{uploads.length === 1 ? "" : "s"}…</span>}
        {!isNew && <button type="button" onClick={remove} className="a-btn a-btn-danger ml-auto"><Trash2 />Delete</button>}
      </div>
    </form>
  );
}
