"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-charcoal/60">{hint}</span>}
    </label>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="border border-forest/15 bg-white p-5 sm:p-6">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  if (!children) return null;
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`admin-fade border px-4 py-3 text-sm ${kind === "error" ? "border-red-800 bg-red-50 text-red-900" : "border-forest bg-forest/5 text-forest"}`}>
      {children}
    </p>
  );
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-bold">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/* ---------- Loading states ---------- */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-4 w-4 animate-spin ${className}`} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Button label that shows a spinner while busy. */
export function BusyLabel({ busy, busyText, children }: { busy: boolean; busyText: string; children: ReactNode }) {
  return busy ? <><Spinner />{busyText}</> : <>{children}</>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function FormSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-9 w-56" />
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="space-y-4 border border-forest/15 bg-white p-6">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-5 sm:grid-cols-2"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
          <Skeleton className="h-24" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-forest/10">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4"><Skeleton className="h-12 w-16 shrink-0" /><Skeleton className="h-4 flex-1" /><Skeleton className="hidden h-4 w-32 sm:block" /></div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/* ---------- Toasts and confirm dialog ---------- */
type ToastItem = { id: number; kind: "success" | "error"; text: string };
type ConfirmOpts = { title: string; body?: string; confirmLabel?: string; danger?: boolean };
type Api = {
  toast: { success: (t: string) => void; error: (t: string) => void };
  confirm: (o: ConfirmOpts) => Promise<boolean>;
};
const Ctx = createContext<Api | null>(null);

function useApi(): Api {
  const c = useContext(Ctx);
  if (!c) throw new Error("Admin feedback provider missing");
  return c;
}
export const useToast = () => useApi().toast;
export const useConfirm = () => useApi().confirm;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: ToastItem["kind"], text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => dismiss(id), kind === "success" ? 4000 : 9000);
  }, [dismiss]);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setDialog(o);
  }), []);
  const answer = (v: boolean) => { resolver.current?.(v); resolver.current = null; setDialog(null); };

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") answer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  const api = useRef<Api>({ toast: { success: (t) => push("success", t), error: (t) => push("error", t) }, confirm }).current;

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-8">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={`admin-pop pointer-events-auto flex w-full max-w-md items-start gap-3 border px-4 py-3 text-sm shadow-lg ${t.kind === "error" ? "border-red-800 bg-red-50 text-red-900" : "border-forest bg-white text-forest"}`}>
            <span aria-hidden className="mt-0.5 font-bold">{t.kind === "error" ? "!" : "✓"}</span>
            <span className="flex-1">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss message" className="-mr-1 px-1 text-lg leading-none opacity-60 hover:opacity-100">×</button>
          </div>
        ))}
      </div>
      {dialog && (
        <div className="admin-fade fixed inset-0 z-50 flex items-center justify-center bg-forest/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) answer(false); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="admin-pop w-full max-w-md border border-forest/20 bg-white p-6 shadow-xl">
            <h2 id="confirm-title" className="text-xl font-bold">{dialog.title}</h2>
            {dialog.body && <p className="mt-2 text-sm text-charcoal/80">{dialog.body}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" autoFocus onClick={() => answer(false)} className="btn btn-outline py-2">Cancel</button>
              <button type="button" onClick={() => answer(true)} className={`btn py-2 ${dialog.danger ? "bg-red-800 text-white hover:bg-red-900" : "btn-forest"}`}>{dialog.confirmLabel || "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
