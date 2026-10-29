"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import CatalogueDownload from "@/components/CatalogueDownload";
import ProductCard from "./ProductCard";
import type { Category, Product } from "@/lib/types";
import { industries } from "@/lib/site";

// Lives until the next full page load, so it tells "first page of this load" (a refresh) from a later visit.
let firstMountOfThisLoad = true;

export default function Catalogue({ products, categories }: { products: Product[]; categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("category") || "all";
  const activeIndustry = industries.some(([, , s]) => s === params.get("industry")) ? (params.get("industry") as string) : "all";
  const [q, setQ] = useState(params.get("q") || "");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (active !== "all" && p.category !== active) return false;
      if (activeIndustry !== "all" && !(p.industries ?? []).includes(activeIndustry)) return false;
      if (!term) return true;
      const hay = [p.name, categories.find((c) => c.slug === p.category)?.name ?? "", ...p.variants, ...p.specifications.map((s) => `${s.label} ${s.value}`)].join(" ").toLowerCase();
      return term.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [products, categories, active, activeIndustry, q]);

  // Keep the box in step when a search is started from the header while already on this page.
  const urlQ = params.get("q") || "";
  useEffect(() => setQ(urlQ), [urlQ]);

  const PAGE = 24;
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [active, activeIndustry, q]);

  // Remember how many products were loaded and where the visitor had scrolled, so a refresh (or coming back from a product page)
  // returns to the same place instead of the top of the list.
  const STORE = "afs-catalogue-view";
  const filterKey = params.toString();
  const restoreY = useRef<number | null>(null);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) || "null") as { key: string; shown: number; y: number; at: number } | null;
      const nav = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
      const refreshed = firstMountOfThisLoad && (nav === "reload" || nav === "back_forward");
      // Set when a product is opened from this list; cleared when the visitor goes anywhere other than the products pages (see CatalogueMemory).
      const wentBack = sessionStorage.getItem(STORE + "-back") === "1";
      sessionStorage.removeItem(STORE + "-back");
      firstMountOfThisLoad = false;
      if (saved && saved.key === filterKey && Date.now() - saved.at < 6 * 3600 * 1000 && (refreshed || wentBack)) {
        setShown(Math.max(PAGE, Math.min(saved.shown, 600)));
        restoreY.current = saved.y;
      }
    } catch { /* storage blocked: start from the top */ }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restored || restoreY.current === null) return;
    const y = restoreY.current;
    restoreY.current = null;
    // Images above the target are still loading and the page grows as they arrive, so keep nudging to the saved spot for a moment
    // (and stop at once if the visitor scrolls themselves).
    let stop = false;
    const halt = () => { stop = true; };
    window.addEventListener("wheel", halt, { once: true, passive: true });
    window.addEventListener("touchstart", halt, { once: true, passive: true });
    const started = Date.now();
    const step = () => {
      if (stop || Date.now() - started > 3000) return;
      if (Math.abs(window.scrollY - y) > 2) window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [restored, shown]);
  useEffect(() => {
    if (!restored) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify({ key: filterKey, shown, y: window.scrollY, at: Date.now() })); } catch { /* ignore */ } };
    const onScroll = () => { clearTimeout(t); t = setTimeout(save, 150); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener("scroll", onScroll); };
  }, [restored, filterKey, shown]);

  const setParam = (key: "category" | "industry", slug: string) => {
    const next = new URLSearchParams(params.toString());
    if (slug === "all") next.delete(key);
    else next.set(key, slug);
    router.replace(`/products${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const clearAll = () => { setQ(""); router.replace("/products", { scroll: false }); };

  const chip = (key: "category" | "industry", current: string, slug: string, name: string) => (
    <button
      key={slug}
      type="button"
      aria-pressed={current === slug}
      onClick={() => setParam(key, slug)}
      className={`border px-4 py-2 font-heading text-sm font-medium transition-colors ${current === slug ? "border-forest bg-forest text-ivory" : "border-forest/30 text-forest hover:border-forest"}`}
    >
      {name}
    </button>
  );

  return (
    <div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-xl">
          <label htmlFor="product-search" className="sr-only">Search products</label>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest/60" aria-hidden />
          <input id="product-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, parts or specifications" className="field pl-10" />
        </div>
        <CatalogueDownload />
        </div>
        <div>
          <p className="eyebrow mb-3">Industry</p>
          <div role="group" aria-label="Filter by industry" className="flex flex-wrap gap-2">
            {chip("industry", activeIndustry, "all", "All industries")}
            {industries.map(([name, , slug]) => chip("industry", activeIndustry, slug, name))}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-3">Category</p>
          <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
            {chip("category", active, "all", "All")}
            {categories.map((c) => chip("category", active, c.slug, c.name))}
          </div>
        </div>
      </div>

      <p className="mt-8 text-sm text-charcoal/70" role="status" aria-live="polite">
        {results.length} {results.length === 1 ? "product" : "products"}
      </p>

      {results.length === 0 ? (
        <div className="mt-6 border border-dashed border-forest/30 bg-white p-10 text-center">
          <h2 className="text-xl font-bold">No matching products</h2>
          <p className="mt-2 text-charcoal/75">Can’t find what you need? We can source to your specification.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="btn btn-outline" onClick={clearAll}>Clear filters</button>
            <a className="btn btn-forest" href={`/contact?message=${encodeURIComponent(q ? `I am looking for: ${q}` : "")}#quote`}>Send an enquiry</a>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) { try { sessionStorage.setItem(STORE + "-back", "1"); } catch { /* ignore */ } } }}>
          {results.slice(0, shown).map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
        </div>
      )}
      {results.length > shown && (
        <div className="mt-10 text-center">
          <p className="text-sm text-charcoal/65">Showing {shown} of {results.length} products</p>
          <button className="btn btn-outline mt-3" onClick={() => setShown(shown + PAGE)}>Show more products</button>
        </div>
      )}
    </div>
  );
}
