"use client";
import { useRef, useState } from "react";
import Turnstile, { type TurnstileHandle } from "@/components/Turnstile";
import { CheckCircle2, Loader2 } from "lucide-react";
import { enquirySchema, validateFile, type FieldErrors } from "@/lib/enquiry";
import { API_URL } from "@/lib/api";

type Props = { products: { slug: string; name: string }[]; initialProduct?: string; initialMessage?: string };
const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function QuoteForm({ products, initialProduct, initialMessage }: Props) {
  const preselected = products.find((p) => p.slug === initialProduct)?.name ?? "";
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const captcha = useRef<TurnstileHandle>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

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
      if (res.ok && json.ok) { setStatus("success"); form.reset(); return; }
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
      <div role="status" className="border border-forest bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto text-forest" size={40} aria-hidden />
        <h3 className="mt-4 text-2xl font-bold">Thank you. Your enquiry has been sent.</h3>
        <p className="mt-2 text-charcoal/80">We will review your requirements and respond by email.</p>
        <button className="btn btn-outline mt-6" onClick={() => setStatus("idle")}>Send another enquiry</button>
      </div>
    );
  }

  const err = (k: keyof FieldErrors) => errors[k];
  const f = (k: keyof FieldErrors) => ({ "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `${k}-err` : undefined });
  const Err = ({ k }: { k: keyof FieldErrors }) => (err(k) ? <p id={`${k}-err`} className="mt-1 text-sm text-red-800">{err(k)}</p> : null);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2" aria-busy={status === "submitting"}>

      <div><label className="label" htmlFor="name">Name *</label><input id="name" name="name" autoComplete="name" required className="field" {...f("name")} /><Err k="name" /></div>
      <div><label className="label" htmlFor="company">Company *</label><input id="company" name="company" autoComplete="organization" required className="field" {...f("company")} /><Err k="company" /></div>
      <div><label className="label" htmlFor="email">Business email *</label><input id="email" name="email" type="email" autoComplete="email" required className="field" {...f("email")} /><Err k="email" /></div>
      <div><label className="label" htmlFor="country">Country *</label><input id="country" name="country" autoComplete="country-name" required className="field" {...f("country")} /><Err k="country" /></div>
      <div><label className="label" htmlFor="phone">Phone (with country code) *</label><input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+44 20 1234 5678" required className="field" {...f("phone")} /><Err k="phone" /></div>
      <div><label className="label" htmlFor="quantity">Quantity</label><input id="quantity" name="quantity" className="field" {...f("quantity")} /></div>

      <div className="sm:col-span-2">
        <label className="label" htmlFor="product">Product or machinery of interest</label>
        <input id="product" name="product" list="product-list" defaultValue={preselected} placeholder="Select or type a product" className="field" />
        <datalist id="product-list">{products.map((p) => <option key={p.slug} value={p.name} />)}</datalist>
      </div>

      <div className="sm:col-span-2"><label className="label" htmlFor="requirements">Technical requirements</label><textarea id="requirements" name="requirements" rows={3} className="field" placeholder="Dimensions, materials, standards, model numbers…" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="message">Message *</label><textarea id="message" name="message" rows={5} required defaultValue={initialMessage} className="field" {...f("message")} /><Err k="message" /></div>

      <div className="sm:col-span-2">
        <label className="label" htmlFor="attachment">Attachment (drawings or specifications, max 5 MB)</label>
        <input id="attachment" name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.doc,.docx,.xls,.xlsx" className="field" {...f("file")} />
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

      {errors.form && <p role="alert" className="border border-red-800 bg-red-50 p-3 text-sm text-red-900 sm:col-span-2">{errors.form}</p>}

      <div className="sm:col-span-2">
        <button type="submit" disabled={status === "submitting"} className="btn btn-forest">
          {status === "submitting" ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Sending…</> : "Send enquiry"}
        </button>
      </div>
    </form>
  );
}
