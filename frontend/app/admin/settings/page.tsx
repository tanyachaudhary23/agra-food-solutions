"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin";
import { BusyLabel, Card, Field, FormSkeleton, lines, Notice, PageTitle, useToast } from "@/components/admin/ui";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => { adminFetch<Settings>("/settings").then(setS).catch((e) => setErr(e.message)); }, []);
  if (!s) return err ? <Notice kind="error">{err}</Notice> : <FormSkeleton cards={4} />;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const text = (k: keyof Settings, label: string, hint?: string, props: { rows?: number; placeholder?: string } = {}) => (
    <Field label={label} hint={hint}>
      {props.rows ? (
        <textarea className="field" rows={props.rows} placeholder={props.placeholder} value={s[k] as string} onChange={(e) => set(k, e.target.value as never)} />
      ) : (
        <input className="field" placeholder={props.placeholder} value={s[k] as string} onChange={(e) => set(k, e.target.value as never)} />
      )}
    </Field>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await adminFetch("/settings", { method: "PUT", body: s });
      toast.success("Settings saved. The website updates within about 30 seconds.");
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <PageTitle title="Settings" />
      <p className="max-w-3xl text-sm text-charcoal/75">Everything here appears on the public website. Anything you leave empty is simply not shown, so fill in only what is verified.</p>
      <Card title="Contact details">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("email", "Public email address", "Shown on the website. Visitors can click it to write to you.")}
          {text("landline", "Landline number(s)")}
          {text("whatsapp", "WhatsApp number", "Digits only with country code, e.g. 919897044651. Shows a WhatsApp button when filled.")}
          <Field label="Mobile numbers (one per line)"><textarea className="field" rows={3} value={s.phones.join("\n")} onChange={(e) => set("phones", lines(e.target.value))} /></Field>
          {text("factoryAddress", "Factory address", undefined, { rows: 3 })}
          {text("registeredOffice", "Registered office address", undefined, { rows: 3 })}
        </div>
      </Card>

      <Card title="Enquiry inbox">
        {text("enquiryRecipient", "Send new enquiries to", "Email address that receives each enquiry. Leave blank to use the one set on the server. (The email account used to SEND is set on the server.)")}
      </Card>

      <Card title="Company facts">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("cin", "CIN")}
          {text("gst", "GST number")}
          {text("iec", "Import Export Code (IEC)")}
          {text("established", "Year established", "Only if you want it shown, e.g. 2016.")}
          <div className="sm:col-span-2">{text("aboutStory", "About the company", "Your story in a few paragraphs. Replaces the default text on the About page.", { rows: 6 })}</div>
          <div className="sm:col-span-2"><Field label="Certifications (one per line)" hint="Only certifications you actually hold, e.g. ISO 9001:2015."><textarea className="field" rows={3} value={s.certifications.join("\n")} onChange={(e) => set("certifications", lines(e.target.value))} /></Field></div>
        </div>
      </Card>

      <Card title="Export terms (shown on the Export page)">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("exportRegions", "Markets / countries served", undefined, { rows: 2 })}
          {text("incoterms", "Shipping terms", "e.g. FOB Mumbai, CIF", { rows: 2 })}
          {text("paymentTerms", "Payment terms", undefined, { rows: 2 })}
          {text("exportDocumentation", "Export documentation provided", undefined, { rows: 2 })}
          {text("minimumOrder", "Minimum order", undefined, { rows: 2 })}
        </div>
      </Card>

      <Card title="Social profiles (full https:// links)">
        <div className="grid gap-5 sm:grid-cols-2">
          {(["linkedin", "facebook", "instagram", "youtube"] as const).map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input className="field" placeholder="https://" value={s.social[k]} onChange={(e) => set("social", { ...s.social, [k]: e.target.value })} /></Field>
          ))}
        </div>
      </Card>

      <Card title="Legal pages">
        <div className="grid gap-5">
          {text("privacyText", "Privacy Policy text", "Leave blank to use the built-in draft. Blank line = new paragraph. Have a lawyer review before launch.", { rows: 8 })}
          {text("termsText", "Terms of Use text", "Leave blank to use the built-in draft.", { rows: 8 })}
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-5 border-t border-forest/15 bg-ivory-200/95 px-5 py-4 backdrop-blur sm:mx-0">
        <button className="btn btn-forest" disabled={busy}><BusyLabel busy={busy} busyText="Saving…">Save settings</BusyLabel></button>
      </div>
    </form>
  );
}
