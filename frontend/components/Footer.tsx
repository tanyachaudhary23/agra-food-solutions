import Link from "next/link";
import { Mail, Phone, MapPin, MessageCircle, ArrowUpRight } from "lucide-react";
import TrackedLink from "@/components/TrackedLink";
import { CATALOGUE_URL } from "@/components/CatalogueDownload";
import { getSettings, nav, site, telHref, whatsappLink } from "@/lib/site";
import { getCategories } from "@/lib/products";

const col = "mt-6 space-y-3 text-sm text-ivory/75";
const link = "link-draw hover:text-brass";

export default async function Footer() {
  const [s, categories] = await Promise.all([getSettings(), getCategories()]);
  const socials = Object.entries(s.social).filter(([, url]) => url);
  return (
    <footer className="mt-8 rounded-t-panel bg-forest text-ivory">
      <div className="container-page pt-20 lg:pt-24">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="font-heading text-5xl font-extrabold tracking-tight text-ivory sm:text-6xl">AFS</p>
            <p className="mt-6 max-w-sm font-serif text-2xl italic leading-snug text-brass">{site.tagline}</p>
            <p className="mt-6 max-w-sm text-sm text-ivory/70">{site.description}</p>
            <Link href="/contact#quote" className="btn btn-brass mt-8">Request a Quote <ArrowUpRight size={16} aria-hidden /></Link>
          </div>

          <div className="grid gap-12 sm:grid-cols-3 lg:col-span-8">
            <div>
              <h2 className="eyebrow !text-brass">Products</h2>
              <ul className={col}>
                {categories.map((c) => <li key={c.slug}><Link className={link} href={`/products?category=${c.slug}`}>{c.name}</Link></li>)}
              </ul>
            </div>
            <div>
              <h2 className="eyebrow !text-brass">Company</h2>
              <ul className={col}>
                {nav.filter((n) => n.href !== "/products").map((n) => <li key={n.href}><Link className={link} href={n.href}>{n.label}</Link></li>)}
                <li><TrackedLink event="Catalogue Download" className={link} href={CATALOGUE_URL} download="Agra-Food-Solutions-Catalogue.pdf">Download catalogue (PDF)</TrackedLink></li>
              </ul>
              {socials.length > 0 && (
                <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ivory/75">
                  {socials.map(([k, url]) => <li key={k}><a className={`${link} capitalize`} href={url} rel="noopener noreferrer" target="_blank">{k}</a></li>)}
                </ul>
              )}
            </div>
            <div>
              <h2 className="eyebrow !text-brass">Contact</h2>
              <ul className={col}>
                {s.email && <li className="flex gap-3"><Mail size={16} className="mt-1 shrink-0 text-brass" aria-hidden /><a href={`mailto:${s.email}`} className={`${link} break-all`}>{s.email}</a></li>}
                {s.phones.map((p) => <li key={p} className="flex gap-3"><Phone size={16} className="mt-1 shrink-0 text-brass" aria-hidden /><a href={telHref(p)} className={link}>{p}</a></li>)}
                {s.landline && <li className="flex gap-3"><Phone size={16} className="mt-1 shrink-0 text-brass" aria-hidden /><span>{s.landline}</span></li>}
                {s.whatsapp && <li className="flex gap-3"><MessageCircle size={16} className="mt-1 shrink-0 text-brass" aria-hidden /><a href={whatsappLink(s.whatsapp)} target="_blank" rel="noopener noreferrer" className={link}>WhatsApp</a></li>}
              </ul>
            </div>
          </div>
        </div>

        {(s.factoryAddress || s.registeredOffice) && (
          <div className="mt-16 grid gap-6 text-sm text-ivory/65 sm:grid-cols-2">
            {s.factoryAddress && <p className="flex gap-3"><MapPin size={16} className="mt-1 shrink-0 text-brass" aria-hidden /><span><strong className="font-semibold text-ivory">Factory</strong><br />{s.factoryAddress}</span></p>}
            {s.registeredOffice && <p className="flex gap-3"><MapPin size={16} className="mt-1 shrink-0 text-brass" aria-hidden /><span><strong className="font-semibold text-ivory">Registered office</strong><br />{s.registeredOffice}</span></p>}
          </div>
        )}

        <div className="mt-14 flex flex-col gap-3 pb-8 pt-6 text-xs text-ivory/50 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {site.name}{s.cin ? ` · CIN ${s.cin}` : ""}</p>
          <ul className="flex gap-6">
            <li><Link className={link} href="/privacy">Privacy Policy</Link></li>
            <li><Link className={link} href="/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
