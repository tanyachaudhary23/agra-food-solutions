"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
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

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-forest/10 bg-ivory lg:hidden">
          <ul className="container-page flex flex-col py-4">
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
