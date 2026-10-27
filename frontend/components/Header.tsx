"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { nav, site } from "@/lib/site";

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className={`font-heading text-2xl font-extrabold tracking-tight ${light ? "text-ivory" : "text-forest"}`}>AFS</span>
      <span className={`hidden text-xs font-medium uppercase tracking-[0.2em] sm:inline ${light ? "text-ivory/70" : "text-charcoal/60"}`}>Agra Food Solutions</span>
    </span>
  );
}

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function SearchForm({ onDone, autoFocus = false, className = "" }: { onDone: () => void; autoFocus?: boolean; className?: string }) {
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
      <label htmlFor={autoFocus ? "site-search" : "site-search-mobile"} className="sr-only">Search products</label>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/50" aria-hidden />
        <input
          id={autoFocus ? "site-search" : "site-search-mobile"}
          type="search"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search products, part numbers or specifications"
          className="field pl-10 pr-24"
        />
        <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-forest px-3 py-1.5 font-heading text-xs font-semibold text-ivory hover:bg-forest-700">Search</button>
      </div>
    </form>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); setSearching(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setSearching(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-forest/10 bg-ivory/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between lg:h-20">
        <Link href="/" aria-label={`${site.name} home`}>
          <BrandMark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={`font-heading text-sm font-medium transition-colors hover:text-brass-700 ${isActive(pathname, n.href) ? "text-brass-700" : "text-forest"}`}
            >
              {n.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setSearching((v) => !v)}
            aria-expanded={searching}
            aria-controls="site-search-panel"
            aria-label={searching ? "Close search" : "Search products"}
            className="p-2 text-forest transition-colors hover:text-brass-700"
          >
            {searching ? <X size={20} /> : <Search size={20} />}
          </button>
          <Link href="/contact#quote" className="btn btn-forest py-2.5">Request a Quote</Link>
        </nav>

        <button
          className="p-2 text-forest lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {searching && (
        <div id="site-search-panel" className="admin-fade hidden border-t border-forest/10 bg-ivory py-4 lg:block">
          <div className="container-page"><SearchForm autoFocus onDone={() => setSearching(false)} className="mx-auto max-w-2xl" /></div>
        </div>
      )}

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-forest/10 bg-ivory lg:hidden">
          <ul className="container-page flex flex-col py-4">
            <li className="pb-3"><SearchForm onDone={() => setOpen(false)} /></li>
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined} className={`block border-b border-forest/10 py-3 font-heading text-base font-medium ${isActive(pathname, n.href) ? "text-brass-700" : "text-forest"}`}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="pt-4">
              <Link href="/contact#quote" className="btn btn-forest w-full">Request a Quote</Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
