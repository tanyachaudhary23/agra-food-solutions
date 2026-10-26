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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <h1 className="text-3xl font-bold">Admin sign in</h1>
      <p className="mt-2 text-sm text-charcoal/70">Agra Food Solutions website management.</p>
      {signedOut && <div className="mt-6"><Notice kind="success">{signedOut}</Notice></div>}
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Email"><input name="email" type="email" autoComplete="username" required className="field" /></Field>
        <Field label="Password"><input name="password" type="password" autoComplete="current-password" required className="field" /></Field>
        <Notice kind="error">{err}</Notice>
        <button className="btn btn-forest w-full" disabled={busy}><BusyLabel busy={busy} busyText="Signing in…">Sign in</BusyLabel></button>
      </form>
    </main>
  );
}
