"use client";
import { useState } from "react";
import { adminFetch, tokenStore } from "@/lib/admin";
import { BusyLabel, Field, Notice, PageTitle, Section, useToast } from "@/components/admin/ui";

export default function Account() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setErr(""); setBusy(true);
    if (f.get("newPassword") !== f.get("confirm")) { setBusy(false); return setErr("The new passwords do not match."); }
    try {
      const r = await adminFetch<{ token?: string }>("/password", { method: "POST", body: { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") } });
      if (r.token) tokenStore.set(r.token);
      toast.success("Password changed. Other devices were signed out.");
      form.reset();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageTitle title="Account" description="Keep your admin sign-in secure." />
      <Section title="Change password" description="Changing it signs you out on every other device.">
        <form onSubmit={submit} className="max-w-md space-y-5">
          <Field label="Current password"><input name="currentPassword" type="password" autoComplete="current-password" required className="a-input" /></Field>
          <Field label="New password" hint="At least 10 characters."><input name="newPassword" type="password" autoComplete="new-password" minLength={10} required className="a-input" /></Field>
          <Field label="Repeat new password"><input name="confirm" type="password" autoComplete="new-password" minLength={10} required className="a-input" /></Field>
          <Notice kind="error">{err}</Notice>
          <button className="a-btn a-btn-primary" disabled={busy}><BusyLabel busy={busy} busyText="Changing…">Change password</BusyLabel></button>
        </form>
      </Section>
    </>
  );
}
