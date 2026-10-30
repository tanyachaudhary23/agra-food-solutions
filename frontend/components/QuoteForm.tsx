"use client";
import { useEffect, useRef, useState } from "react";
import Turnstile, { type TurnstileHandle } from "@/components/Turnstile";
import { CheckCircle2, Loader2 } from "lucide-react";
import { enquirySchema, validateFile, type FieldErrors } from "@/lib/enquiry";
import { API_URL } from "@/lib/api";
import { useQuoteList } from "@/components/QuoteList";
import { track } from "@/lib/analytics";

type Props = { products: { slug: string; name: string }[]; initialProduct?: string; initialMessage?: string };
const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function QuoteForm({ products, initialProduct, initialMessage }: Props) {
  const preselected = products.find((p) => p.slug === initialProduct)?.name ?? "";
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const captcha = useRef<TurnstileHandle>(null);
  const list = useQuoteList();

  // "Request a Quote" on a product opens this form with that product in the quote list (once), so single and multi-product enquiries work the same way.
  const preselect = products.find((p) => p.slug === initialProduct);
  const added = useRef(false);
  useEffect(() => {
    if (preselect && !added.current) { added.current = true; list.add({ slug: preselect.slug, name: preselect.name }, { silent: true }); }
  }, [preselect, list]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    // With a quote list, the product line is built from it (name and wanted quantity per product).
    if (list.items.length) data.set("product", list.items.map((i, n) => `${n + 1}. ${i.name}${i.qty.trim() ? ` - ${i.qty.trim()}` : ""}`).join("\n"));

    // The server checks these slugs, so an enquiry for a product that was deleted in the meantime is refused.
    data.set("productSlugs", list.items.map((i) => i.slug).join(","));

    // Client-side validation (the server validates again)
    const raw = Object.fromEntries(
      ["name", "company", "email", "country", "phone", "product", "quantity", "requirements", "message"].map((k) => [k, String(data.get(k) ?? "")])
    );
    const parsed = enquirySchema.safeParse({ ...raw, consent: data.get("consent") ? "true" : "" });
    const next: FieldErrors = {};
    if (!parsed.success) for (const i of parsed.error.issues) { const k = i.path[0] as keyof FieldErrors; if (!next[k]) next[k] = i.message; }
    const file = data.get("attachment");
    if (file instanceof File && file.size > 0) { const fe = validateFile(file.name, file.size); if (fe) next.file = fe; }
    setErrors(next);
    if (Object.keys(next).length) {
      form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }

    data.set("consent", "true");
    setStatus("submitting");
    try {
      const res = await fetch(`${API_URL}/api/enquiries`, { method: "POST", body: data });
      const json = await res.json().catch(() => ({}));
      captcha.current?.reset();
      if (res.ok && json.ok) { setStatus("success"); track("Enquiry Sent", { products: list.items.length }); form.reset(); list.clear(); return; }
      if (Array.isArray(json.unavailable)) for (const s of json.unavailable as string[]) list.remove(s);
      setErrors(json.errors || { form: "Something went wrong. Please try again." });
      setStatus("error");
    } catch {
      captcha.current?.reset();
      setErrors({ form: "We could not reach the server. Please check your connection and try again, or contact us directly." });
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div role="status" className="rounded-panel bg-sand p-10 text-center">
        <CheckCircle2 className="mx-auto text-forest" size={40} aria-hidden />
        <h3 className="mt-4 font-heading text-subtitle font-semibold">Thank you. Your enquiry has been sent.</h3>
        <p className="mt-2 text-charcoal/80">We will review your requirements and respond by email.</p>
        <button className="btn btn-outline mt-6" onClick={() => setStatus("idle")}>Send another enquiry</button>
      </div>
    );
  }

  const err = (k: keyof FieldErrors) => errors[k];
  const f = (k: keyof FieldErrors) => ({ "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `${k}-err` : undefined });
  const Err = ({ k }: { k: keyof FieldErrors }) => (err(k) ? <p id={`${k}-err`} className="mt-1 text-sm text-red-800">{err(k)}</p> : null);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 sm:grid-cols-2" aria-busy={status === "submitting"}>

      <div><label className="label" htmlFor="name">Name *</label><input id="name" name="name" autoComplete="name" required className="field" {...f("name")} /><Err k="name" /></div>
      <div><label className="label" htmlFor="company">Company *</label><input id="company" name="company" autoComplete="organization" required className="field" {...f("company")} /><Err k="company" /></div>
      <div><label className="label" htmlFor="email">Business email *</label><input id="email" name="email" type="email" autoComplete="email" required className="field" {...f("email")} /><Err k="email" /></div>
      <div><label className="label" htmlFor="country">Country *</label><input id="country" name="country" autoComplete="country-name" required className="field" {...f("country")} /><Err k="country" /></div>
      <div><label className="label" htmlFor="phone">Phone (with country code) *</label><input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+44 20 1234 5678" required className="field" {...f("phone")} /><Err k="phone" /></div>
      {list.items.length === 0 && <div><label className="label" htmlFor="quantity">Quantity</label><input id="quantity" name="quantity" className="field" {...f("quantity")} /></div>}

      {list.items.length > 0 ? (
        <div className="rounded-card bg-sand p-5 sm:col-span-2" aria-labelledby="quote-list-title">
          <div className="flex items-center justify-between gap-3">
            <h3 id="quote-list-title" className="font-heading text-sm font-semibold uppercase tracking-wider text-forest">Your quote list ({list.items.length})</h3>
            <button type="button" onClick={list.clear} className="text-sm font-semibold text-forest underline hover:text-brass-700">Clear list</button>
          </div>
          <ul className="mt-3 divide-y divide-forest/10">
            {list.items.map((i) => (
              <li key={i.slug} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm font-medium">{i.name}</span>
                <label className="sr-only" htmlFor={`qty-${i.slug}`}>Quantity for {i.name}</label>
                <input id={`qty-${i.slug}`} value={i.qty} onChange={(e) => list.setQty(i.slug, e.target.value)} placeholder="Quantity, e.g. 50 pcs" maxLength={30} className="field !w-44 !py-1.5" />
                <button type="button" onClick={() => list.remove(i.slug)} className="text-sm font-semibold text-red-800 underline" aria-label={`Remove ${i.name} from the list`}>Remove</button>
              </li>
            ))}
          </ul>
          <a href="/products" className="mt-3 inline-block text-sm font-semibold text-forest underline hover:text-brass-700">Add more products</a>
        </div>
      ) : (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="product">Product or machinery of interest</label>
          <input id="product" name="product" list="product-list" defaultValue={preselected} placeholder="Select or type a product" className="field" />
          <datalist id="product-list">{products.map((p) => <option key={p.slug} value={p.name} />)}</datalist>
          <p className="mt-1 text-xs text-charcoal/60">Tip: use &ldquo;Add to quote list&rdquo; on the Products page to quote several products in one enquiry.</p>
        </div>
      )}

      <div className="sm:col-span-2"><label className="label" htmlFor="requirements">Technical requirements</label><textarea id="requirements" name="requirements" rows={3} className="field" placeholder="Dimensions, materials, standards, model numbers…" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="message">Message *</label><textarea id="message" name="message" rows={5} required defaultValue={initialMessage} className="field" {...f("message")} /><Err k="message" /></div>

      <div className="sm:col-span-2">
        <label className="label" htmlFor="attachment">Attachment (drawings or specifications, max 5 MB)</label>
        <input id="attachment" name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.doc,.docx,.xls,.xlsx" className="field file:mr-4 file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-ivory" {...f("file")} />
        <Err k="file" />
      </div>

      {/* Honeypot: hidden from people, filled by bots */}
      <div aria-hidden className="absolute -left-[9999px]"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      {TURNSTILE_KEY && <Turnstile ref={captcha} siteKey={TURNSTILE_KEY} />}

      <div className="sm:col-span-2">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-1 h-4 w-4 accent-forest" {...f("consent")} />
          <span>I agree that my details may be used to respond to this enquiry, as described in the <a href="/privacy" className="underline">Privacy Policy</a>. *</span>
        </label>
        <Err k="consent" />
      </div>

      {errors.form && <p role="alert" className="rounded-soft bg-red-50 p-4 text-sm text-red-900 sm:col-span-2">{errors.form}</p>}

      <div className="sm:col-span-2">
        <button type="submit" disabled={status === "submitting"} className="btn btn-forest !px-8 !py-4">
          {status === "submitting" ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Sending…</> : "Send enquiry"}
        </button>
      </div>
    </form>
  );
}
