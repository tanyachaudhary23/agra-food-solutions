"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminFetch, tokenStore } from "@/lib/admin";
import { BusyLabel, Field, Notice } from "@/components/admin/ui";

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("signedout")) setSignedOut("You have been signed out. Sign in again to continue.");
    else if (q.get("expired")) setSignedOut("Your session ended for security. Please sign in again.");
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      const r = await adminFetch<{ token: string }>("/login", { method: "POST", body: { email: f.get("email"), password: f.get("password") } });
      tokenStore.set(r.token);
      router.replace("/admin");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="a-login-art relative hidden flex-col justify-between p-14 text-[#F4F0E8] lg:flex">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#F4F0E8]/10 font-heading text-sm font-extrabold tracking-wide text-[color:var(--a-accent)] ring-1 ring-[#F4F0E8]/20">AFS</span>
        <div className="a-rise max-w-md">
          <p className="a-eyebrow !text-[color:var(--a-accent)]">Admin workspace</p>
          <h1 className="mt-4 font-heading text-[40px] font-bold leading-[1.1] !text-[#F4F0E8]">Manage the catalogue, enquiries and website content in one place.</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-[#F4F0E8]/70">Agra Food Solutions Pvt. Ltd.: spare parts for roller flour mills and grain milling.</p>
        </div>
        <p className="text-xs text-[#F4F0E8]/50">Private area. Authorised staff only.</p>
      </aside>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="a-rise w-full max-w-[380px]">
          <span className="mb-8 grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--a-brand)] font-heading text-sm font-extrabold tracking-wide text-[color:var(--a-accent)] lg:hidden">AFS</span>
          <h2 className="text-[30px] font-bold">Sign in</h2>
          <p className="mt-1.5 text-[14.5px] text-[color:var(--a-ink2)]">Use your admin email and password.</p>
          {signedOut && <div className="mt-6"><Notice kind="success">{signedOut}</Notice></div>}
          <form onSubmit={submit} className="mt-8 space-y-5">
            <Field label="Email"><input name="email" type="email" autoComplete="username" required className="a-input" /></Field>
            <Field label="Password"><input name="password" type="password" autoComplete="current-password" required className="a-input" /></Field>
            <Notice kind="error">{err}</Notice>
            <button className="a-btn a-btn-primary w-full !h-11" disabled={busy}><BusyLabel busy={busy} busyText="Signing in…">Sign in</BusyLabel></button>
          </form>
        </div>
      </section>
    </main>
  );
}
