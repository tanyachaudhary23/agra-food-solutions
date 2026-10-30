"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Menu, Search, X } from "lucide-react";
import { industries, nav, site } from "@/lib/site";
import { useQuoteList } from "@/components/QuoteList";
import CatalogueDownload from "@/components/CatalogueDownload";

type Cat = { slug: string; name: string };

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className={`font-heading text-2xl font-extrabold tracking-tight ${light ? "text-ivory" : "text-forest"}`}>AFS</span>
      <span className={`hidden text-[11px] font-medium uppercase tracking-[0.22em] sm:inline ${light ? "text-ivory/70" : "text-charcoal/55"}`}>Agra Food Solutions</span>
    </span>
  );
}

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function SearchForm({ onDone, id, autoFocus = false, className = "" }: { onDone: () => void; id: string; autoFocus?: boolean; className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const term = value.trim();
        router.push(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
        setValue("");
        onDone();
      }}
    >
      <label htmlFor={id} className="sr-only">Search products</label>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/50" aria-hidden />
        <input id={id} type="search" autoFocus={autoFocus} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search products, part numbers or specifications" className="field !rounded-full pl-11 pr-24" />
        <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-forest px-4 py-2 font-heading text-xs font-semibold text-ivory transition-colors hover:bg-forest-700">Search</button>
      </div>
    </form>
  );
}

export default function Header({ categories = [] }: { categories?: Cat[] }) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [megaOff, setMegaOff] = useState(false); // closes the products menu right after a link in it is used
  const pathname = usePathname();
  const { items } = useQuoteList();

  useEffect(() => { setOpen(false); setSearching(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setSearching(false); } };
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", onScroll); };
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  const quoteLabel = items.length ? `Request a Quote, ${items.length} product${items.length === 1 ? "" : "s"} in your list` : undefined;

  return (
    <>
    <header className={`sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-out-soft ${scrolled ? "bg-paper/85 shadow-soft backdrop-blur-xl" : "bg-paper"}`}>
      <div className={`container-page flex items-center justify-between transition-[height] duration-300 ease-out-soft ${scrolled ? "h-16" : "h-[4.5rem] lg:h-20"}`}>
        <Link href="/" aria-label={`${site.name} home`}><BrandMark /></Link>

        <nav aria-label="Primary" className="hidden h-full items-center gap-9 lg:flex">
          {nav.map((n) =>
            n.href === "/products" ? (
              <div key={n.href} className="group flex h-full items-center" onMouseLeave={() => setMegaOff(false)}>
                <Link href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined} aria-haspopup="true" className={`link-draw inline-flex items-center gap-1 font-heading text-sm font-medium ${isActive(pathname, n.href) ? "text-brass-700" : "text-forest"}`}>
                  {n.label}
                  <ChevronDown size={14} aria-hidden className="transition-transform duration-300 group-hover:rotate-180 group-focus-within:rotate-180" />
                </Link>
                {/* Products menu: categories and industries, opens on hover or keyboard focus */}
                <div
                  className={`invisible absolute inset-x-0 top-full translate-y-2 opacity-0 transition-all duration-300 ease-out-soft group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 ${megaOff ? "" : "group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"}`}
                  onClick={() => setMegaOff(true)}
                >
                  <div className="container-page">
                    <div className="grid gap-10 rounded-b-panel bg-paper p-10 shadow-lift lg:grid-cols-12">
                      <div className="lg:col-span-6">
                        <p className="eyebrow">Categories</p>
                        <ul className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3">
                          {categories.map((c) => (
                            <li key={c.slug}><Link href={`/products?category=${c.slug}`} className="link-draw font-heading text-sm font-medium text-forest hover:text-brass-700">{c.name}</Link></li>
                          ))}
                        </ul>
                      </div>
                      <div className="lg:col-span-3">
                        <p className="eyebrow">Industries</p>
                        <ul className="mt-5 space-y-3">
                          {industries.map(([name, , slug]) => (
                            <li key={slug}><Link href={`/products?industry=${slug}`} className="link-draw font-heading text-sm font-medium text-forest hover:text-brass-700">{name}</Link></li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col justify-between rounded-card bg-sand p-6 lg:col-span-3">
                        <p className="font-heading text-base font-semibold text-forest">Browse everything we supply.</p>
                        <div className="mt-6 flex flex-col gap-2">
                          <Link href="/products" className="btn btn-forest !py-2.5">All products <ArrowRight size={14} aria-hidden /></Link>
                          <CatalogueDownload className="btn btn-outline !py-2.5" label="Download PDF" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined} className={`link-draw font-heading text-sm font-medium ${isActive(pathname, n.href) ? "text-brass-700" : "text-forest hover:text-brass-700"}`}>
                {n.label}
              </Link>
            )
          )}
          <button type="button" onClick={() => setSearching((v) => !v)} aria-expanded={searching} aria-controls="site-search-panel" aria-label={searching ? "Close search" : "Search products"} className="-mx-2 rounded-full p-2 text-forest transition-colors hover:bg-sand hover:text-brass-700">
            {searching ? <X size={20} /> : <Search size={20} />}
          </button>
          <Link href="/contact#quote" className="btn btn-forest relative !py-2.5" aria-label={quoteLabel}>
            Request a Quote
            {items.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brass px-1 text-[11px] font-bold text-forest">{items.length}</span>}
          </Link>
        </nav>

        <button className="-mr-2 rounded-full p-2 text-forest lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label="Open menu" onClick={() => setOpen(true)}>
          <span className="relative block">
            <Menu size={24} />
            {items.length > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brass px-1 font-heading text-[11px] font-bold text-forest">{items.length}</span>}
          </span>
        </button>
      </div>

      {searching && (
        <div id="site-search-panel" className="admin-fade hidden pb-5 lg:block">
          <div className="container-page"><SearchForm id="site-search" autoFocus onDone={() => setSearching(false)} className="mx-auto max-w-2xl" /></div>
        </div>
      )}

    </header>

      {/* Mobile menu: a drawer that slides in from the right */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-forest-900/50 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
        <nav id="mobile-nav" aria-label="Mobile" {...(open ? {} : { inert: true })} className={`absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-paper p-6 shadow-lift transition-transform duration-500 ease-out-soft ${open ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between">
            <BrandMark />
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="-mr-2 rounded-full p-2 text-forest hover:bg-sand"><X size={24} /></button>
          </div>
          <div className="mt-6"><SearchForm id="site-search-mobile" onDone={() => setOpen(false)} /></div>
          <ul className="mt-6 flex flex-col">
            {nav.map((n, i) => (
              <li key={n.href} className={`transition-all duration-500 ease-out-soft ${open ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"}`} style={{ transitionDelay: open ? `${120 + i * 45}ms` : "0ms" }}>
                <Link href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined} className={`block py-3.5 font-heading text-2xl font-semibold tracking-tight ${isActive(pathname, n.href) ? "text-brass-700" : "text-forest"}`}>{n.label}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-8">
            <Link href="/contact#quote" className="btn btn-forest w-full">Request a Quote{items.length ? ` (${items.length})` : ""}</Link>
          </div>
        </nav>
      </div>
    </>
  );
}
