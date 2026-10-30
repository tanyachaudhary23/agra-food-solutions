"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin";
import { BusyLabel, Field, FormSkeleton, lines, Notice, PageTitle, Section, useToast, useUnsavedChanges } from "@/components/admin/ui";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [err, setErr] = useState("");
  const [snap, setSnap] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const dirty = !!s && snap !== "" && JSON.stringify(s) !== snap;
  useUnsavedChanges(dirty);

  useEffect(() => { adminFetch<Settings>("/settings").then((r) => { setS(r); setSnap(JSON.stringify(r)); }).catch((e) => setErr(e.message)); }, []);
  if (!s) return err ? <Notice kind="error">{err}</Notice> : <FormSkeleton sections={4} />;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const text = (k: keyof Settings, label: string, hint?: string, props: { rows?: number; placeholder?: string } = {}) => (
    <Field label={label} hint={hint}>
      {props.rows ? (
        <textarea className="a-input" rows={props.rows} placeholder={props.placeholder} value={s[k] as string} onChange={(e) => set(k, e.target.value as never)} />
      ) : (
        <input className="a-input" placeholder={props.placeholder} value={s[k] as string} onChange={(e) => set(k, e.target.value as never)} />
      )}
    </Field>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await adminFetch("/settings", { method: "PUT", body: s });
      setSnap(JSON.stringify(s));
      toast.success("Settings saved. The website updates within about 30 seconds.");
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} >
      <PageTitle title="Settings" description="Everything here appears on the public website. Anything you leave empty is simply not shown, so fill in only what is verified." />
      <Section title="Contact details" description="How buyers reach you. Shown in the website header, footer and contact page.">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("email", "Public email address", "Shown on the website. Visitors can click it to write to you.")}
          {text("landline", "Landline number(s)")}
          {text("whatsapp", "WhatsApp number", "Digits only with country code, e.g. 919897044651. Shows a WhatsApp button when filled.")}
          <Field label="Mobile numbers (one per line)"><textarea className="a-input" rows={3} value={s.phones.join("\n")} onChange={(e) => set("phones", lines(e.target.value))} /></Field>
          {text("factoryAddress", "Factory address", undefined, { rows: 3 })}
          {text("registeredOffice", "Registered office address", undefined, { rows: 3 })}
        </div>
      </Section>

      <Section title="Enquiry inbox" description="Where new enquiries are emailed.">
        {text("enquiryRecipient", "Send new enquiries to", "Email address that receives each enquiry. Leave blank to use the one set on the server. (The email account used to SEND is set on the server.)")}
      </Section>

      <Section title="Company facts" description="Legal details and your story, shown on the About page.">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("cin", "CIN")}
          {text("gst", "GST number")}
          {text("iec", "Import Export Code (IEC)")}
          {text("established", "Year established", "Only if you want it shown, e.g. 2016.")}
          <div className="sm:col-span-2">{text("aboutStory", "About the company", "Your story in a few paragraphs. Replaces the default text on the About page.", { rows: 6 })}</div>
          <div className="sm:col-span-2"><Field label="Certifications (one per line)" hint="Only certifications you actually hold, e.g. ISO 9001:2015."><textarea className="a-input" rows={3} value={s.certifications.join("\n")} onChange={(e) => set("certifications", lines(e.target.value))} /></Field></div>
        </div>
      </Section>

      <Section title="Export terms" description="Terms buyers look for before they enquire.">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("exportRegions", "Markets / countries served", undefined, { rows: 2 })}
          {text("incoterms", "Shipping terms", "e.g. FOB Mumbai, CIF", { rows: 2 })}
          {text("paymentTerms", "Payment terms", undefined, { rows: 2 })}
          {text("exportDocumentation", "Export documentation provided", undefined, { rows: 2 })}
          {text("minimumOrder", "Minimum order", undefined, { rows: 2 })}
        </div>
      </Section>

      <Section title="Social profiles" description="Full https:// links. Empty ones are hidden.">
        <div className="grid gap-5 sm:grid-cols-2">
          {(["linkedin", "facebook", "instagram", "youtube"] as const).map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input className="a-input" placeholder="https://" value={s.social[k]} onChange={(e) => set("social", { ...s.social, [k]: e.target.value })} /></Field>
          ))}
        </div>
      </Section>

      <Section title="Legal pages" description="Leave blank to use the built-in drafts.">
        <div className="grid gap-5">
          {text("privacyText", "Privacy Policy text", "Leave blank to use the built-in draft. Blank line = new paragraph. Have a lawyer review before launch.", { rows: 8 })}
          {text("termsText", "Terms of Use text", "Leave blank to use the built-in draft.", { rows: 8 })}
        </div>
      </Section>

      <div className="a-savebar flex items-center gap-4">
        <button className="a-btn a-btn-primary" disabled={busy || !dirty}><BusyLabel busy={busy} busyText="Saving…">Save settings</BusyLabel></button>
        {dirty && <span className="a-status a-status-new a-fade" role="status">Unsaved changes</span>}
      </div>
    </form>
  );
}
