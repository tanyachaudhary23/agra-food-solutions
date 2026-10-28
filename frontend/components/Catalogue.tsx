"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import CatalogueDownload from "@/components/CatalogueDownload";
import ProductCard from "./ProductCard";
import type { Category, Product } from "@/lib/types";
import { industries } from "@/lib/site";

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
      if (activeIndustry !== "all" && !p.industries.includes(activeIndustry)) return false;
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
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
