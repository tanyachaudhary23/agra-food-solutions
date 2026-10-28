"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import { track } from "@/lib/analytics";
import { API_URL } from "@/lib/api";

export type QuoteItem = { slug: string; name: string; qty: string };
type Ctx = {
  items: QuoteItem[];
  has: (slug: string) => boolean;
  add: (p: { slug: string; name: string }, opts?: { silent?: boolean }) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: string) => void;
  clear: () => void;
};

const KEY = "afs-quote-list";
const MAX_ITEMS = 12;
const QuoteCtx = createContext<Ctx | null>(null);

function load(): QuoteItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((i) => i && typeof i.slug === "string" && typeof i.name === "string")
      .slice(0, MAX_ITEMS)
      .map((i) => ({ slug: i.slug, name: i.name.slice(0, 120), qty: typeof i.qty === "string" ? i.qty.slice(0, 30) : "" }));
  } catch { return []; }
}

/** The buyer's list of products to quote, kept in this browser only (nothing is sent until they submit the enquiry). */
export function QuoteListProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ name: string; n: number } | null>(null);
  const [removedNote, setRemovedNote] = useState("");
  const latest = useRef<QuoteItem[]>([]);
  latest.current = items;

  useEffect(() => {
    // Child effects (e.g. the quote form adding the product the buyer clicked) run before this one, so merge instead of overwriting.
    const saved = load();
    const merged = [...saved, ...latest.current.filter((x) => !saved.some((s) => s.slug === x.slug))].slice(0, MAX_ITEMS);
    latest.current = merged;
    setItems(merged);
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setItems(load()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage blocked: list lives for this visit only */ }
  }, [items, ready]);

  // Take products that have since been deleted or hidden off the list (on load, and whenever the tab is shown again).
  useEffect(() => {
    if (!ready) return;
    let stop = false;
    async function reconcile() {
      if (!latest.current.length) return;
      try {
        const res = await fetch(`${API_URL}/api/products`, { cache: "no-store" });
        if (!res.ok) return;
        const live = new Set(((await res.json()) as { slug: string }[]).map((p) => p.slug));
        const gone = latest.current.filter((i) => !live.has(i.slug));
        if (!stop && gone.length) {
          latest.current = latest.current.filter((i) => live.has(i.slug));
          setItems(latest.current);
          setRemovedNote(`${gone.map((g) => g.name).join(", ")} ${gone.length > 1 ? "are" : "is"} no longer available and ${gone.length > 1 ? "were" : "was"} removed from your quote list.`);
        }
      } catch { /* offline: keep the list as it is */ }
    }
    reconcile();
    const onShow = () => { if (document.visibilityState === "visible") reconcile(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { stop = true; document.removeEventListener("visibilitychange", onShow); };
  }, [ready]);

  useEffect(() => {
    if (!removedNote) return;
    const t = setTimeout(() => setRemovedNote(""), 9000);
    return () => clearTimeout(t);
  }, [removedNote]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const add = useCallback((p: { slug: string; name: string }, opts?: { silent?: boolean }) => {
    const c = latest.current;
    if (c.some((i) => i.slug === p.slug) || c.length >= MAX_ITEMS) return;
    latest.current = [...c, { slug: p.slug, name: p.name, qty: "" }];
    setItems(latest.current);
    if (!opts?.silent) { setToast({ name: p.name, n: latest.current.length }); track("Quote List Add", { product: p.name }); }
  }, []);
  const remove = useCallback((slug: string) => setItems((c) => c.filter((i) => i.slug !== slug)), []);
  const setQty = useCallback((slug: string, qty: string) => setItems((c) => c.map((i) => (i.slug === slug ? { ...i, qty: qty.slice(0, 30) } : i))), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo<Ctx>(() => ({ items, has: (s) => items.some((i) => i.slug === s), add, remove, setQty, clear }), [items, add, remove, setQty, clear]);
  return (
    <QuoteCtx.Provider value={value}>
      {children}
      {toast && (
        <div role="status" className="admin-pop fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 border border-forest bg-forest px-4 py-3 text-sm text-ivory shadow-xl sm:bottom-6">
          <Check size={18} className="shrink-0 text-brass" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{toast.name}</span>
            <span className="text-ivory/75">Added to your quote list ({toast.n})</span>
          </span>
          <Link href="/contact#quote" onClick={() => setToast(null)} className="shrink-0 bg-brass px-3 py-1.5 font-heading text-xs font-semibold text-forest hover:bg-ivory">View list</Link>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="shrink-0 text-ivory/70 hover:text-ivory"><X size={16} aria-hidden /></button>
        </div>
      )}
      {removedNote && (
        <div role="alert" className="admin-pop fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-start gap-3 border border-red-800 bg-white px-4 py-3 text-sm text-charcoal shadow-xl sm:bottom-6">
          <span className="min-w-0 flex-1">{removedNote}</span>
          <button type="button" onClick={() => setRemovedNote("")} aria-label="Dismiss" className="shrink-0 text-charcoal/60 hover:text-charcoal"><X size={16} aria-hidden /></button>
        </div>
      )}
    </QuoteCtx.Provider>
  );
}

export const useQuoteList = () => {
  const c = useContext(QuoteCtx);
  if (!c) throw new Error("useQuoteList must be used inside QuoteListProvider");
  return c;
};
export { MAX_ITEMS };

export function AddToQuoteButton({ product, className = "" }: { product: { slug: string; name: string }; className?: string }) {
  const { has, add, remove, items } = useQuoteList();
  const inList = has(product.slug);
  const full = !inList && items.length >= MAX_ITEMS;
  return (
    <button
      type="button"
      disabled={full}
      aria-pressed={inList}
      onClick={() => (inList ? remove(product.slug) : add(product))}
      title={full ? `Your list is full (${MAX_ITEMS} products). Send this enquiry first.` : undefined}
      className={className || "inline-flex items-center gap-1 font-heading text-sm font-semibold text-forest hover:text-brass-700 disabled:opacity-50"}
    >
      {inList ? <><Check size={14} aria-hidden /> In quote list</> : <><Plus size={14} aria-hidden /> Add to quote list</>}
    </button>
  );
}
