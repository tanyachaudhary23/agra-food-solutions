import Link from "next/link";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { CATALOGUE_URL } from "@/components/CatalogueDownload";
import { getSettings, nav, site, telHref, whatsappLink } from "@/lib/site";
import { getCategories } from "@/lib/products";
import { BrandMark } from "./Header";

export default async function Footer() {
  const [s, categories] = await Promise.all([getSettings(), getCategories()]);
  const socials = Object.entries(s.social).filter(([, url]) => url);
  return (
    <footer className="bg-forest text-ivory">
      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <BrandMark light />
          <p className="mt-5 max-w-xs text-sm text-ivory/75">{site.description}</p>
          {socials.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-4 text-sm">
              {socials.map(([k, url]) => (
                <li key={k}><a className="capitalize underline-offset-4 hover:underline" href={url} rel="noopener noreferrer" target="_blank">{k}</a></li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="eyebrow !text-brass">Products</h2>
          <ul className="mt-5 space-y-2 text-sm text-ivory/80">
            {categories.map((c) => (
              <li key={c.slug}><Link className="hover:text-brass" href={`/products?category=${c.slug}`}>{c.name}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="eyebrow !text-brass">Company</h2>
          <ul className="mt-5 space-y-2 text-sm text-ivory/80">
            {nav.filter((n) => n.href !== "/products").map((n) => (
              <li key={n.href}><Link className="hover:text-brass" href={n.href}>{n.label}</Link></li>
            ))}
            <li><Link className="hover:text-brass" href="/contact#quote">Request a Quote</Link></li>
            <li><a className="hover:text-brass" href={CATALOGUE_URL} download="Agra-Food-Solutions-Catalogue.pdf">Download catalogue (PDF)</a></li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow !text-brass">Contact</h2>
          <ul className="mt-5 space-y-3 text-sm text-ivory/80">
            {s.email && <li className="flex gap-2"><Mail size={16} className="mt-1 shrink-0 text-brass" /><a href={`mailto:${s.email}`} className="break-all hover:text-brass">{s.email}</a></li>}
            {s.phones.map((p) => <li key={p} className="flex gap-2"><Phone size={16} className="mt-1 shrink-0 text-brass" /><a href={telHref(p)} className="hover:text-brass">{p}</a></li>)}
            {s.landline && <li className="flex gap-2"><Phone size={16} className="mt-1 shrink-0 text-brass" /><span>{s.landline}</span></li>}
            {s.whatsapp && <li className="flex gap-2"><MessageCircle size={16} className="mt-1 shrink-0 text-brass" /><a href={whatsappLink(s.whatsapp)} target="_blank" rel="noopener noreferrer" className="hover:text-brass">WhatsApp</a></li>}
            {s.factoryAddress && <li className="flex gap-2"><MapPin size={16} className="mt-1 shrink-0 text-brass" /><span><strong className="font-semibold text-ivory">Factory:</strong> {s.factoryAddress}</span></li>}
            {s.registeredOffice && <li className="flex gap-2"><MapPin size={16} className="mt-1 shrink-0 text-brass" /><span><strong className="font-semibold text-ivory">Registered office:</strong> {s.registeredOffice}</span></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-ivory/15">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-ivory/60 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {site.name}{s.cin ? ` · CIN ${s.cin}` : ""} · All rights reserved.</p>
          <ul className="flex gap-6">
            <li><Link className="hover:text-brass" href="/privacy">Privacy Policy</Link></li>
            <li><Link className="hover:text-brass" href="/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
