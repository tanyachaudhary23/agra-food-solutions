"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

/* ---------- Layout and form building blocks ---------- */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="a-label">{label}</span>
      {children}
      {hint && <span className="a-hint">{hint}</span>}
    </label>
  );
}

/** A form section: the title and explanation sit on the left, the fields on the right. No box around it. */
export function Section({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="a-section">
      <div>
        <h2 className="a-section-title">{title}</h2>
        {description && <p className="a-section-desc">{description}</p>}
        {actions && <div className="mt-4">{actions}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** A quiet surface for content that needs to stand apart (use sparingly). */
export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="a-panel">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-[17px] font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const NOTICE_ICON = { error: AlertCircle, success: CheckCircle2, info: Info } as const;
export function Notice({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  if (!children) return null;
  const Icon = NOTICE_ICON[kind];
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`a-notice a-fade a-notice-${kind}`}>
      <Icon aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function PageTitle({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14.5px] text-[color:var(--a-ink2)]">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="a-fade flex flex-col items-center px-6 py-16 text-center">
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-[color:var(--a-sunk)] text-[color:var(--a-ink2)] [&>svg]:h-5 [&>svg]:w-5">{icon}</div>}
      <p className="font-heading text-[16px] font-bold">{title}</p>
      {children && <p className="mt-1.5 max-w-sm text-[13.5px] text-[color:var(--a-ink2)]">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
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
  return <div aria-hidden className={`a-skel ${className}`} />;
}

export function FormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      <Skeleton className="mb-8 h-9 w-56" />
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="grid gap-6 border-t border-[color:var(--a-line)] py-8 lg:grid-cols-[250px_1fr] lg:gap-14">
          <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-48" /></div>
          <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-11" /><Skeleton className="h-11" /></div><Skeleton className="h-24" /></div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="a-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-[color:var(--a-line)] px-3 py-4">
          <Skeleton className="h-14 w-14 shrink-0 !rounded-xl" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
          <Skeleton className="hidden h-4 w-24 sm:block" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/* ---------- Drawer (slide-over panel) ---------- */
export function Drawer({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) { setShown(true); setClosing(false); return; }
    if (!shown) return;
    setClosing(true);
    const t = setTimeout(() => { setShown(false); setClosing(false); }, 180);
    return () => clearTimeout(t);
  }, [open, shown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!shown) return null;
  return (
    <>
      <div className="a-backdrop" data-closing={closing} onMouseDown={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={title} className="a-drawer" data-closing={closing}>
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--a-line)] px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-[19px] font-bold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[13px] text-[color:var(--a-ink2)]">{subtitle}</div>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close panel" className="a-btn a-btn-quiet a-btn-icon -mr-2 -mt-1"><X /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <div className="border-t border-[color:var(--a-line)] bg-[color:var(--a-bg)] px-6 py-4">{footer}</div>}
      </aside>
    </>
  );
}

/* ---------- Toasts, confirm dialog, unsaved-changes guard ---------- */
type ToastItem = { id: number; kind: "success" | "error"; text: string };
type ConfirmOpts = { title: string; body?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type Api = {
  toast: { success: (t: string) => void; error: (t: string) => void };
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  /** True while a screen has unsaved changes. The sidebar asks before leaving. */
  guard: MutableRefObject<boolean>;
};
const Ctx = createContext<Api | null>(null);

function useApi(): Api {
  const c = useContext(Ctx);
  if (!c) throw new Error("Admin feedback provider missing");
  return c;
}
export const useToast = () => useApi().toast;
export const useConfirm = () => useApi().confirm;
export const useGuardRef = () => useApi().guard;

/** Call with `true` while the form has unsaved changes: warns before closing the tab, and the admin menu asks before leaving. */
export function useUnsavedChanges(dirty: boolean) {
  const guard = useGuardRef();
  useEffect(() => {
    guard.current = dirty;
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty, guard]);
  useEffect(() => () => { guard.current = false; }, [guard]);
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const nextId = useRef(1);
  const guard = useRef(false);

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

  const api = useRef<Api>({ toast: { success: (t) => push("success", t), error: (t) => push("error", t) }, confirm, guard }).current;

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-8">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} data-kind={t.kind} className="a-toast pointer-events-auto">
            {t.kind === "error" ? <AlertCircle aria-hidden /> : <CheckCircle2 aria-hidden />}
            <span className="min-w-0 flex-1">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss message" className="-my-1 grid h-6 w-6 place-items-center rounded-md opacity-70 transition hover:bg-white/10 hover:opacity-100"><X className="!m-0 h-4 w-4 !text-current" /></button>
          </div>
        ))}
      </div>
      {dialog && (
        <div className="a-backdrop flex items-center justify-center p-4" style={{ zIndex: 90 }} onMouseDown={(e) => { if (e.target === e.currentTarget) answer(false); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="a-dialog">
            <h2 id="confirm-title" className="text-[19px] font-bold">{dialog.title}</h2>
            {dialog.body && <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--a-ink2)]">{dialog.body}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" autoFocus onClick={() => answer(false)} className="a-btn a-btn-ghost">{dialog.cancelLabel || "Cancel"}</button>
              <button type="button" onClick={() => answer(true)} className={`a-btn ${dialog.danger ? "a-btn-danger-solid" : "a-btn-primary"}`}>{dialog.confirmLabel || "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
